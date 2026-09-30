import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db';
import { User, UserRole, CustomerProfile, TechnicianProfile } from '../../src/types/index';
import { sendSms } from './smsService';
import { VerificationCodeService } from './verificationCodeService';
import { validateAdminPassword } from '../../src/utils/adminPasswordPolicy';
import { phonesMatch, normalizeNgPhone } from '../../src/utils/format';

/** bcrypt work factor for newly created hashes (existing cost-8 hashes keep verifying and are not rewritten). */
const BCRYPT_COST = 12;

/** Password policy shared by register, reset, change and set-password (mirrored client-side in src/utils/passwordPolicy.ts). */
export const PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters long and contain at least one number.';
export function isPasswordAcceptable(password: unknown): password is string {
  return typeof password === 'string' && password.length >= 8 && /\d/.test(password);
}

// Pre-computed hash used to keep response time similar for unknown users (limits account enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync('fixhub-dummy-password', BCRYPT_COST);

const DEFAULT_DEV_JWT_SECRET = 'fixhub-dev-secret-key-production-change-me';

/**
 * Returns the JWT signing secret. In production a missing / default / weak secret is a hard error
 * (the public default value would let anyone mint valid admin tokens). Outside production the dev
 * default is still used for convenience.
 */
export function getJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET?.trim();
  if (env.NODE_ENV === 'production') {
    if (!secret || secret === DEFAULT_DEV_JWT_SECRET || secret.toLowerCase().includes('dev-secret') || secret.length < 32) {
      throw new Error('FATAL: A secure JWT_SECRET (minimum 32 characters, not the default) is required in production.');
    }
    return secret;
  }
  return secret || DEFAULT_DEV_JWT_SECRET;
}

export interface AuthSession {
  token: string;
  user: User;
  customerProfile?: CustomerProfile;
  technicianProfile?: TechnicianProfile;
}

export class AuthService {
  /**
   * The only shape in which a stored user leaves the server: never the password hash, session version or other
   * internals. `hasPassword` lets the UI tell social-login-only accounts (which must set a password first).
   */
  public static toPublicUser(user: any, extra: Partial<User> = {}): User {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      phoneVerified: Boolean(user.phoneVerified),
      phoneVerifiedAt: user.phoneVerifiedAt,
      emailVerified: Boolean(user.emailVerified),
      emailVerifiedAt: user.emailVerifiedAt,
      authProvider: user.authProvider || 'local',
      hasPassword: Boolean(user.passwordHash),
      ...(user.role === 'admin' ? { mustChangePassword: Boolean(user.mustChangePassword) } : {}),
      ...extra,
    };
  }

  public static generateToken(user: User, isBorrowedDevice = false): string {
    // Shorter expiry on borrowed devices; admin sessions are always short (8h) and revocable (sessionVersion).
    const expiresIn = user.role === 'admin' ? '8h' : isBorrowedDevice ? '2h' : '30d';
    const sessionVersion = (user as any).sessionVersion || 1;
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        isBorrowedDevice,
        sessionVersion,
      },
      getJwtSecret(),
      // jti makes every token unique: without it a login in the same second as a logout would mint the byte-identical
      // (already revoked) token.
      { algorithm: 'HS256', expiresIn, jwtid: crypto.randomUUID() }
    );
  }

  public static verifyToken(token: string): { id: string; email: string; role: UserRole; isBorrowedDevice?: boolean; sessionVersion?: number } | null {
    if (!token || typeof token !== 'string') return null;
    if (this.isTokenRevoked(token)) return null;
    try {
      const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as any;
      if (!decoded || !decoded.id) return null;
      const user = db.users.find((u) => u.id === decoded.id);
      if (!user) return null;
      // A suspended account (admin portal) loses every existing session immediately.
      if (user.status === 'suspended') return null;
      const userSessionVersion = (user as any).sessionVersion || 1;
      if (decoded.sessionVersion !== undefined && decoded.sessionVersion < userSessionVersion) {
        return null;
      }
      // The role always comes from the database, never from the (possibly stale) token claim.
      return { ...decoded, role: user.role };
    } catch {
      return null;
    }
  }

  // Reset / e-mail / phone verification codes are NOT kept here: see VerificationCodeService (hashed, durable).

  /** Tokens are stored/compared as SHA-256 digests, so the revocation table never contains a usable credential. */
  private static tokenDigest(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Revokes a JWT (logout, account deletion). The revocation is kept in `db.revokedTokenHashes` and
   * written through to the `revoked_tokens` table, so it survives restarts. Rows expire with the token.
   */
  public static revokeToken(token: string): void {
    const digest = this.tokenDigest(token);
    db.revokedTokenHashes.add(digest);
    const decoded: any = jwt.decode(token);
    const expMs = decoded && typeof decoded.exp === 'number' ? decoded.exp * 1000 : Date.now() + 30 * 24 * 60 * 60 * 1000;
    db.queueWrite(
      `INSERT INTO revoked_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT (token_hash) DO NOTHING`,
      [digest, decoded?.id ?? null, new Date(Math.max(expMs, Date.now() + 60 * 1000)).toISOString()]
    );
  }

  public static isTokenRevoked(token: string): boolean {
    return db.revokedTokenHashes.has(this.tokenDigest(token));
  }

  public static async requestPasswordReset(emailOrPhone: string): Promise<{ success: boolean; message: string }> {
    const clean = emailOrPhone.trim().toLowerCase();
    const user = db.users.find((u) => u.email.toLowerCase() === clean || (u.phone && phonesMatch(u.phone, clean)));
    // Admin passwords are never reset over SMS (SIM-swap takeover risk): `npm run admin:create -- --reset-password` only.
    if (!user || user.role === 'admin') {
      return { success: true, message: 'If an account exists with this credential, a password reset code has been sent.' };
    }

    const resetCode = crypto.randomInt(100000, 1000000).toString();
    VerificationCodeService.issueByCode('reset', resetCode, { userId: user.id }, 15 * 60 * 1000);

    // Deliver reset code via SMS or Email service
    const smsResult = await sendSms(user.phone, `Your Fixhub password reset code is: ${resetCode}. Valid for 15 minutes.`);
    if (!smsResult.success) {
      console.error(`[AuthService.requestPasswordReset] Failed to deliver reset SMS to user ${user.id} (${user.phone}): ${smsResult.error}`);
    }

    return {
      success: true,
      message: 'If an account exists with this credential, a password reset code has been sent.',
    };
  }

  public static resetPasswordWithCode(code: string, newPassword: string): { success: boolean; error?: string } {
    const record = VerificationCodeService.findByCode('reset', code);
    if (!record || !record.userId) {
      return { success: false, error: 'Invalid or expired password reset code.' };
    }

    if (!isPasswordAcceptable(newPassword)) {
      return { success: false, error: PASSWORD_POLICY_MESSAGE };
    }

    const user = db.users.find((u) => u.id === record.userId);
    if (!user) {
      return { success: false, error: 'User not found.' };
    }

    user.passwordHash = bcrypt.hashSync(newPassword, BCRYPT_COST);
    (user as any).sessionVersion = ((user as any).sessionVersion || 1) + 1;
    VerificationCodeService.consumeByCode('reset', code);
    db.save();

    return { success: true };
  }

  /**
   * Re-authentication for sensitive actions (delete account, switch role): checks the CURRENT password of the
   * already-authenticated user. Accounts that have no password (social-login only) cannot be re-authenticated
   * this way and get `NO_PASSWORD` — they must set a password first (POST /auth/change-password allows that).
   */
  public static confirmPassword(userId: string, password: unknown): { ok: true } | { ok: false; reason: 'NO_PASSWORD' | 'INVALID' } {
    const user = db.users.find((u) => u.id === userId);
    if (!user) return { ok: false, reason: 'INVALID' };
    if (!user.passwordHash) return { ok: false, reason: 'NO_PASSWORD' };
    const supplied = typeof password === 'string' ? password.slice(0, 200) : '';
    const match = bcrypt.compareSync(supplied, user.passwordHash);
    return supplied && match ? { ok: true } : { ok: false, reason: 'INVALID' };
  }

  public static changePassword(
    userId: string,
    currentPassword: string | undefined,
    newPassword: string
  ): { success: boolean; message?: string; error?: string; token?: string } {
    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      return { success: false, error: 'User account not found.' };
    }

    if (user.passwordHash && user.passwordHash.length > 0) {
      if (!currentPassword) {
        return { success: false, error: 'Current password is required to update your password.' };
      }
      const isMatch = bcrypt.compareSync(currentPassword, user.passwordHash);
      if (!isMatch) {
        return { success: false, error: 'The current password you entered is incorrect.' };
      }
    }

    if (user.role === 'admin') {
      const adminMsg = validateAdminPassword(newPassword, { email: user.email, name: user.name });
      if (adminMsg) return { success: false, error: adminMsg };
      if (typeof newPassword === 'string' && user.passwordHash && bcrypt.compareSync(newPassword, user.passwordHash)) {
        return { success: false, error: 'The new password must be different from the current one.' };
      }
    } else if (!isPasswordAcceptable(newPassword)) {
      return {
        success: false,
        error: 'New password must be at least 8 characters long and contain at least one number.',
      };
    }

    user.passwordHash = bcrypt.hashSync(newPassword, BCRYPT_COST);
    (user as any).sessionVersion = ((user as any).sessionVersion || 1) + 1;
    if (user.role === 'admin') (user as any).mustChangePassword = false;
    db.save();

    // The session version was bumped (every other session is signed out), so hand the caller a fresh token
    // or its own next request would 401.
    return { success: true, message: 'Password updated successfully.', token: this.generateToken(user as any) };
  }

  /**
   * First password for an account that has none (social / Google sign-in only). Refused when a password already
   * exists (use changePassword, which demands the current one). Same policy + bcrypt cost as registration.
   * Bumps the session version so any other session (e.g. a stolen token) is signed out, and returns a fresh token.
   */
  public static setPassword(
    userId: string,
    newPassword: unknown
  ): { success: true; message: string; token: string } | { success: false; status: 400 | 404 | 409; code: string; error: string } {
    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      return { success: false, status: 404, code: 'USER_NOT_FOUND', error: 'User account not found.' };
    }
    if (user.passwordHash && user.passwordHash.length > 0) {
      return {
        success: false,
        status: 409,
        code: 'PASSWORD_ALREADY_SET',
        error: 'This account already has a password. Use "Update Password" and enter your current password to change it.',
      };
    }
    if (!isPasswordAcceptable(newPassword)) {
      return { success: false, status: 400, code: 'WEAK_PASSWORD', error: PASSWORD_POLICY_MESSAGE };
    }

    user.passwordHash = bcrypt.hashSync(newPassword, BCRYPT_COST);
    (user as any).sessionVersion = ((user as any).sessionVersion || 1) + 1;
    db.save();

    return { success: true, message: 'Password set. You can now also sign in with your email and password.', token: this.generateToken(user as any) };
  }

  public static async requestEmailVerification(userId: string): Promise<{ success: boolean; message: string }> {
    const user = db.users.find((u) => u.id === userId);
    if (!user) return { success: false, message: 'User not found.' };

    const code = crypto.randomInt(100000, 1000000).toString();
    VerificationCodeService.issueByCode('email', code, { userId: user.id, email: user.email }, 30 * 60 * 1000);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV EMAIL VERIFY] Verification code for ${user.email}: ${code}`);
    }

    return { success: true, message: 'Verification code sent.' };
  }

  public static confirmEmailVerification(code: string): { success: boolean; error?: string } {
    const record = VerificationCodeService.findByCode('email', code);
    if (!record) {
      return { success: false, error: 'Invalid or expired verification code.' };
    }

    const user = db.users.find((u) => u.id === record.userId);
    if (user) {
      (user as any).emailVerified = true;
      (user as any).emailVerifiedAt = new Date().toISOString();
      db.save();
    }

    VerificationCodeService.consumeByCode('email', code);
    return { success: true };
  }

  public static async requestPhoneVerification(phoneOrUserId: string, authenticatedUserId?: string): Promise<{ success: boolean; message: string }> {
    const clean = phoneOrUserId.trim();
    const user = (authenticatedUserId ? db.users.find((u) => u.id === authenticatedUserId) : null) ||
      db.users.find((u) => u.id === clean || (u.phone && phonesMatch(u.phone, clean)));
    const targetPhone = user?.phone ? user.phone : clean;

    const code = crypto.randomInt(100000, 1000000).toString();
    const phoneKey = normalizeNgPhone(targetPhone) || targetPhone.replace(/\s+/g, '');
    const userKey = user ? user.id : phoneKey;

    VerificationCodeService.issuePhone(
      [userKey, phoneKey],
      code,
      { userId: user?.id || authenticatedUserId, phone: targetPhone },
      15 * 60 * 1000
    );

    await sendSms(targetPhone, `Your Fixhub verification code is: ${code}. Valid for 15 minutes.`);

    return { success: true, message: 'Verification code sent via SMS.' };
  }

  public static confirmPhoneVerification(phoneOrUserId: string, code: string, authenticatedUserId?: string): { success: boolean; user?: User; error?: string } {
    const clean = phoneOrUserId.trim();
    const phoneKey = normalizeNgPhone(clean) || clean.replace(/\s+/g, '');

    const record = VerificationCodeService.findPhone([clean, phoneKey, authenticatedUserId]);

    if (!record || !VerificationCodeService.phoneCodeMatches(record, code)) {
      return { success: false, error: 'Invalid or expired phone verification code.' };
    }

    const targetUserId = record.userId || authenticatedUserId;
    let user = targetUserId ? db.users.find((u) => u.id === targetUserId) : null;
    if (!user) {
      user = db.users.find((u) => u.id === clean || (u.phone ? phonesMatch(u.phone, clean) : false));
    }

    if (user) {
      if (record.phone) {
        user.phone = record.phone;
      }
      (user as any).phoneVerified = true;
      (user as any).phoneVerifiedAt = new Date().toISOString();

      if (user.role === 'technician') {
        const tech = db.technicianProfiles.find((t) => t.userId === user.id);
        if (tech && !tech.phone && user.phone) {
          tech.phone = user.phone;
        }
      }
      db.save();
    }

    VerificationCodeService.deletePhone([clean, phoneKey, record.userId, authenticatedUserId, record.phone ? normalizeNgPhone(record.phone) || record.phone.replace(/\s+/g, '') : undefined]);

    const safeUser: User | undefined = user ? this.toPublicUser(user) : undefined;

    return { success: true, user: safeUser };
  }

  public static ensureCustomerProfile(user: User): CustomerProfile {
    let profile = db.customerProfiles.find((c) => c.userId === user.id);
    if (!profile) {
      profile = {
        userId: user.id,
        savedLocations: [],
        totalRepairsCount: 0,
        activeRepairsCount: 0,
        defaultLocation: {
          lat: 4.8156,
          lng: 7.0498,
          address: '',
          landmark: '',
          city: 'Port Harcourt',
          state: 'Rivers State',
        },
        notificationPreferences: {
          repairUpdates: true,
          paymentUpdates: true,
          promotional: false,
        },
      };
      db.customerProfiles.push(profile);
      db.save();
    } else {
      if (!profile.defaultLocation) {
        profile.defaultLocation = {
          lat: 4.8156,
          lng: 7.0498,
          address: '',
          landmark: '',
          city: 'Port Harcourt',
          state: 'Rivers State',
        };
      }
      if (!profile.notificationPreferences) {
        profile.notificationPreferences = {
          repairUpdates: true,
          paymentUpdates: true,
          promotional: false,
        };
      }
    }
    return profile;
  }

  public static ensureTechnicianProfile(
    user: User,
    additionalData?: Partial<TechnicianProfile>
  ): TechnicianProfile {
    let profile = db.technicianProfiles.find(
      (t) => t.userId === user.id || (t as any).id === user.id
    );

    if (!profile) {
      const displayName = user.name || (user.email ? user.email.split('@')[0] : 'Fixhub Technician');
      profile = {
        userId: user.id,
        name: displayName,
        businessName:
          additionalData?.businessName ||
          (user.name ? `${user.name}'s Repair Lab` : 'Fixhub Pro Repair Hub'),
        bio:
          additionalData?.bio ||
          'Certified mobile phone technician specializing in fast screen replacements, battery repairs, charging ports, and motherboard recovery.',
        shopLocation: additionalData?.shopLocation || {
          lat: 4.8156,
          lng: 7.0498,
          address: 'Port Harcourt, Rivers State',
          landmark: 'Garrison Junction',
          area: 'Port Harcourt',
          city: 'Port Harcourt',
          state: 'Rivers State',
        },
        serviceRadiusKm: additionalData?.serviceRadiusKm || 15,
        businessHours:
          additionalData?.businessHours || 'Mon - Sat: 8:30 AM - 6:30 PM',
        yearsExperience: additionalData?.yearsExperience || 3,
        phone: user.phone || additionalData?.phone || '',
        avatarUrl:
          user.avatarUrl ||
          additionalData?.avatarUrl ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`,
        shopPhotos: additionalData?.shopPhotos || [],
        supportedBrands: additionalData?.supportedBrands || [
          'Apple',
          'Samsung',
          'Tecno',
          'Infinix',
          'Xiaomi',
        ],
        supportedCategories: additionalData?.supportedCategories || [
          'screen_damaged',
          'screen_not_displaying',
          'battery_problem',
          'charging_problem',
          'speaker_problem',
        ],
        availability: additionalData?.availability || 'AVAILABLE',
        rating: additionalData?.rating || 5.0,
        reviewCount: additionalData?.reviewCount || 0,
        completedJobs: additionalData?.completedJobs || 0,
        quoteAccuracyScore: 100,
        cancellationRate: 0,
        averageResponseMinutes: 15,
        trustScore: 75,
        trustLevel: 'NEW',
        verificationStatus: additionalData?.verificationStatus || {
          basic: true,
          locationConfirmed: true,
          identityVerified: false,
          businessVerified: false,
          payoutVerified: false,
        },
        bankDetails: additionalData?.bankDetails,
      } as any;
      db.technicianProfiles.push(profile);
      db.save();
    } else if (additionalData) {
      // Apply any incoming updates to existing profile
      Object.assign(profile, additionalData);
      db.save();
    }
    return profile;
  }

  public static login(emailOrPhone: string, password?: string, isBorrowedDevice = false): AuthSession | { error: string } {
    const cleanIdentifier = emailOrPhone.trim().toLowerCase();
    const user = db.users.find((u) => u.email.toLowerCase() === cleanIdentifier || (u.phone ? phonesMatch(u.phone, cleanIdentifier) : false));

    // A password is ALWAYS required on this path. Social (Google) logins go through
    // AuthService.socialLogin / POST /auth/social-login, which verify a provider token instead.
    if (typeof password !== 'string' || password.length === 0) {
      return { error: 'Password is required.' };
    }
    // Same message for "unknown user" and "wrong password" (no account enumeration); a dummy bcrypt
    // comparison keeps timing similar when the user does not exist.
    const passwordOk = bcrypt.compareSync(password, user?.passwordHash || DUMMY_HASH);
    // Admin accounts sign in ONLY through POST /admin/auth/login (own rate limit + lockout); here they look like
    // any other wrong credential.
    if (!user || !user.passwordHash || !passwordOk || user.role === 'admin') {
      return { error: 'Invalid email/phone or password.' };
    }
    if (user.status === 'suspended') {
      return { error: 'This account has been suspended. Please contact Fixhub support.' };
    }

    if (user.role === 'technician') {
      this.ensureTechnicianProfile(user);
    } else if (user.role === 'customer') {
      this.ensureCustomerProfile(user);
    }
    user.lastLoginAt = new Date().toISOString();

    const token = this.generateToken(user, isBorrowedDevice);
    const customerProfile = db.customerProfiles.find((c) => c.userId === user.id);
    const technicianProfile = db.technicianProfiles.find((t) => t.userId === user.id || (t as any).id === user.id);

    const safeUser: User = this.toPublicUser(user, { isBorrowedDeviceSession: isBorrowedDevice });

    return {
      token,
      user: safeUser,
      customerProfile,
      technicianProfile,
    };
  }

  public static registerCustomer(data: {
    name: string;
    phone: string;
    email: string;
    password?: string;
    address?: string;
    landmark?: string;
    city?: string;
    state?: string;
    isBorrowedDevice?: boolean;
  }): AuthSession | { error: string } {
    if (!isPasswordAcceptable(data.password)) {
      return { error: PASSWORD_POLICY_MESSAGE };
    }

    const phone = normalizeNgPhone(data.phone) || data.phone.trim();
    const existing = db.users.find((u) => u.email.toLowerCase() === data.email.trim().toLowerCase() || (u.phone ? phonesMatch(u.phone, phone) : false));
    if (existing) {
      return { error: 'An account with this email or phone already exists.' };
    }

    const userId = `usr_cust_${Date.now()}`;
    const passwordHash = bcrypt.hashSync(data.password, BCRYPT_COST);
    const now = new Date().toISOString();

    const newUser = {
      id: userId,
      email: data.email.trim().toLowerCase(),
      phone,
      name: data.name.trim(),
      role: 'customer' as UserRole,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.name)}`,
      createdAt: now,
      passwordHash,
      phoneVerified: false,
      emailVerified: false,
    };

    db.users.push(newUser as any);

    const newCustomerProfile: CustomerProfile = {
      userId,
      savedLocations: data.address
        ? [
            {
              lat: 4.8156,
              lng: 7.0498,
              address: data.address,
              landmark: data.landmark || '',
              city: data.city || 'Port Harcourt',
              state: data.state || 'Rivers State',
              country: 'Nigeria',
              source: 'DEVELOPMENT_FALLBACK',
            },
          ]
        : [],
      defaultLocation: data.address
        ? {
            lat: 4.8156,
            lng: 7.0498,
            address: data.address,
            landmark: data.landmark || '',
            city: data.city || 'Port Harcourt',
            state: data.state || 'Rivers State',
            country: 'Nigeria',
            source: 'DEVELOPMENT_FALLBACK',
          }
        : undefined,
      totalRepairsCount: 0,
      activeRepairsCount: 0,
    };

    db.customerProfiles.push(newCustomerProfile);
    db.save();

    const token = this.generateToken(newUser as any, !!data.isBorrowedDevice);

    const safeUser: User = this.toPublicUser(newUser, { isBorrowedDeviceSession: !!data.isBorrowedDevice });

    return {
      token,
      user: safeUser,
      customerProfile: newCustomerProfile,
    };
  }

  public static registerTechnician(data: {
    name: string;
    phone: string;
    email: string;
    businessName: string;
    password?: string;
    shopAddress: string;
    landmark?: string;
    area?: string;
    city?: string;
    state?: string;
    supportedBrands?: string[];
  }): AuthSession | { error: string } {
    if (!isPasswordAcceptable(data.password)) {
      return { error: PASSWORD_POLICY_MESSAGE };
    }

    const phone = normalizeNgPhone(data.phone) || data.phone.trim();
    const existing = db.users.find((u) => u.email.toLowerCase() === data.email.trim().toLowerCase() || (u.phone ? phonesMatch(u.phone, phone) : false));
    if (existing) {
      return { error: 'An account with this email or phone already exists.' };
    }

    const userId = `usr_tech_${Date.now()}`;
    const passwordHash = bcrypt.hashSync(data.password, BCRYPT_COST);
    const now = new Date().toISOString();

    const newUser = {
      id: userId,
      email: data.email.trim().toLowerCase(),
      phone,
      name: data.name.trim(),
      role: 'technician' as UserRole,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.businessName)}`,
      createdAt: now,
      passwordHash,
      phoneVerified: false,
      emailVerified: false,
    };

    db.users.push(newUser as any);

    const newTechProfile: TechnicianProfile = {
      userId,
      businessName: data.businessName.trim(),
      bio: `Professional mobile phone repair center in ${data.city || 'Port Harcourt'}, ${data.state || 'Rivers State'}. Specializing in screen, battery, and motherboard repairs.`,
      shopLocation: {
        lat: 4.8156,
        lng: 7.0498,
        address: data.shopAddress || `${data.city || 'Port Harcourt'}, ${data.state || 'Rivers State'}`,
        landmark: data.landmark || '',
        area: data.area || data.city || 'Port Harcourt',
        city: data.city || 'Port Harcourt',
        state: data.state || 'Rivers State',
      },
      serviceRadiusKm: 15,
      businessHours: 'Mon - Sat: 8:30 AM - 6:30 PM',
      yearsExperience: 3,
      phone,
      avatarUrl: newUser.avatarUrl,
      shopPhotos: [],
      supportedBrands: data.supportedBrands || ['Apple', 'Samsung', 'Tecno', 'Infinix'],
      supportedCategories: ['screen_damaged', 'screen_not_displaying', 'battery_problem', 'charging_problem', 'speaker_problem'],
      availability: 'AVAILABLE',
      rating: 5.0,
      reviewCount: 0,
      completedJobs: 0,
      quoteAccuracyScore: 100,
      cancellationRate: 0,
      averageResponseMinutes: 15,
      trustScore: 75,
      trustLevel: 'NEW',
      verificationStatus: {
        basic: true,
        locationConfirmed: true,
        identityVerified: false,
        businessVerified: false,
        payoutVerified: false,
      },
    };

    db.technicianProfiles.push(newTechProfile);
    db.save();

    const token = this.generateToken(newUser, false);

    const safeUser: User = this.toPublicUser(newUser);

    return {
      token,
      user: safeUser,
      technicianProfile: newTechProfile,
    };
  }

  public static getUserSession(userId: string): AuthSession | null {
    const user = db.users.find((u) => u.id === userId);
    if (!user) return null;

    if (user.role === 'technician') {
      this.ensureTechnicianProfile(user);
    } else if (user.role === 'customer') {
      this.ensureCustomerProfile(user);
    }

    const token = this.generateToken(user as any);
    const customerProfile = db.customerProfiles.find((c) => c.userId === user.id);
    const technicianProfile = db.technicianProfiles.find((t) => t.userId === user.id || (t as any).id === user.id);

    const safeUser: User = this.toPublicUser(user);

    return {
      token,
      user: safeUser,
      customerProfile,
      technicianProfile,
    };
  }

  public static async socialLogin(params: {
    provider: 'google';
    token: string;
    role?: UserRole;
  }): Promise<{
    success: boolean;
    token?: string;
    user?: User;
    customerProfile?: any;
    technicianProfile?: any;
    error?: string;
  }> {
    const { provider, token, role = 'customer' } = params;
    if (!token || !token.trim()) {
      return { success: false, error: 'OAuth token is required.' };
    }

    let verifiedIdentity: { email: string; name?: string; avatarUrl?: string };

    if (provider === 'google') {
      const clientId =
        process.env.GOOGLE_CLIENT_ID ||
        process.env.VITE_GOOGLE_CLIENT_ID ||
        '56408372166-fdcat8gp2ildbktlu1q5u3ab9pad5t0b.apps.googleusercontent.com';
      try {
        const cleanToken = token.trim();
        const isJwt = cleanToken.split('.').length === 3;
        let payload: any = null;

        if (isJwt) {
          try {
            const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(cleanToken)}`, {
              signal: AbortSignal.timeout(5000),
            });
            if (res.ok) {
              payload = (await res.json()) as any;
            } else {
              const errData = (await res.json().catch(() => ({}))) as any;
              return { success: false, error: errData?.error_description || 'Invalid or expired Google token.' };
            }
          } catch (fetchErr: any) {
            return { success: false, error: `Google verification network error: ${fetchErr.message}` };
          }

          if (!payload) {
            return { success: false, error: 'Failed to verify Google token.' };
          }

          const isDev = process.env.NODE_ENV !== 'production';
          if (payload.aud !== clientId && !(isDev && process.env.SKIP_AUD_CHECK)) {
            return { success: false, error: 'Google token audience mismatch.' };
          }
        } else {
          // OAuth 2.0 Access Token verification
          const [tokenInfoRes, userInfoRes] = await Promise.all([
            fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(cleanToken)}`, {
              signal: AbortSignal.timeout(4000),
            }).catch(() => null),
            fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${cleanToken}` },
              signal: AbortSignal.timeout(4000),
            }).catch(() => null),
          ]);

          if (tokenInfoRes && !tokenInfoRes.ok) {
            const errData = (await tokenInfoRes.json().catch(() => ({}))) as any;
            return { success: false, error: errData?.error_description || 'Invalid or expired Google access token.' };
          }

          const tokenInfo = tokenInfoRes && tokenInfoRes.ok ? ((await tokenInfoRes.json()) as any) : null;
          const isDev = process.env.NODE_ENV !== 'production';
          if (tokenInfo && tokenInfo.aud !== clientId && tokenInfo.azp !== clientId && !(isDev && process.env.SKIP_AUD_CHECK)) {
            return { success: false, error: 'Google token audience mismatch.' };
          }

          const userInfo = userInfoRes && userInfoRes.ok ? ((await userInfoRes.json()) as any) : {};
          payload = {
            email: userInfo.email || tokenInfo?.email,
            name: userInfo.name || userInfo.given_name || (tokenInfo?.email ? tokenInfo.email.split('@')[0] : 'Google User'),
            picture: userInfo.picture,
          };
        }

        if (!payload.email) {
          return { success: false, error: 'No verified email returned from Google.' };
        }
        verifiedIdentity = {
          email: payload.email,
          name: payload.name || payload.email.split('@')[0],
          avatarUrl: payload.picture,
        };
      } catch (err: any) {
        return { success: false, error: `Google verification network error: ${err.message}` };
      }
    } else {
      return { success: false, error: 'Unsupported social provider. Only Google is supported.' };
    }

    const cleanEmail = verifiedIdentity.email.toLowerCase().trim();
    let user = db.users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (user && user.role === 'admin') {
      return { success: false, error: 'Admin accounts must sign in through the admin portal with their password.' };
    }
    if (user && user.status === 'suspended') {
      return { success: false, error: 'This account has been suspended. Please contact Fixhub support.' };
    }

    if (user) {
      user.emailVerified = true;
      user.emailVerifiedAt = user.emailVerifiedAt || new Date().toISOString();
      if (!user.authProvider || user.authProvider === 'local') {
        user.authProvider = provider;
      }
      // Preserve existing user role if already registered
      db.save();
    } else {
      const targetRole = role === 'technician' ? 'technician' : 'customer';
      const userId = `usr_social_${Date.now()}`;
      user = {
        id: userId,
        email: cleanEmail,
        phone: '',
        name: verifiedIdentity.name || cleanEmail.split('@')[0],
        role: targetRole,
        avatarUrl: verifiedIdentity.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(verifiedIdentity.name || cleanEmail)}`,
        createdAt: new Date().toISOString(),
        emailVerified: true,
        emailVerifiedAt: new Date().toISOString(),
        phoneVerified: false,
        authProvider: provider,
      } as any;
      db.users.push(user as any);
      db.save();
    }

    if (user.role === 'technician') {
      this.ensureTechnicianProfile(user);
    } else if (user.role === 'customer') {
      this.ensureCustomerProfile(user);
    }

    const sessionToken = this.generateToken(user as any);
    const safeUser: User = this.toPublicUser(user);

    const customerProfile = db.customerProfiles.find((c) => c.userId === user.id) || null;
    const technicianProfile = db.technicianProfiles.find((t) => t.userId === user.id || (t as any).id === user.id) || null;

    return {
      success: true,
      token: sessionToken,
      user: safeUser,
      customerProfile: customerProfile || undefined,
      technicianProfile: technicianProfile || undefined,
    };
  }
}
