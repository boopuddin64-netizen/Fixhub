import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db';
import { User, UserRole, CustomerProfile, TechnicianProfile } from '../../src/types/index';
import { sendSms } from './smsService';

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
  public static generateToken(user: User, isBorrowedDevice = false): string {
    const expiresIn = isBorrowedDevice ? '2h' : '30d'; // Shorter expiry on borrowed devices
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
      { algorithm: 'HS256', expiresIn }
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
      const userSessionVersion = (user as any).sessionVersion || 1;
      if (decoded.sessionVersion !== undefined && decoded.sessionVersion < userSessionVersion) {
        return null;
      }
      return decoded;
    } catch {
      return null;
    }
  }

  private static resetTokens: Map<string, { userId: string; expiresAt: number }> = new Map();
  private static emailVerifyTokens: Map<string, { userId: string; email: string; expiresAt: number }> = new Map();
  private static phoneVerifyTokens: Map<string, { userId?: string; phone: string; code: string; expiresAt: number }> = new Map();
  private static revokedTokens: Set<string> = new Set();

  public static revokeToken(token: string): void {
    this.revokedTokens.add(token);
  }

  public static isTokenRevoked(token: string): boolean {
    return this.revokedTokens.has(token);
  }

  public static async requestPasswordReset(emailOrPhone: string): Promise<{ success: boolean; message: string }> {
    const clean = emailOrPhone.trim().toLowerCase();
    const user = db.users.find(
      (u) => u.email.toLowerCase() === clean || (u.phone && u.phone.replace(/\s+/g, '') === clean.replace(/\s+/g, ''))
    );
    if (!user) {
      return { success: true, message: 'If an account exists with this credential, a password reset code has been sent.' };
    }

    const resetCode = crypto.randomInt(100000, 1000000).toString();
    this.resetTokens.set(resetCode, {
      userId: user.id,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

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
    const record = this.resetTokens.get(code);
    if (!record || record.expiresAt < Date.now()) {
      return { success: false, error: 'Invalid or expired password reset code.' };
    }

    if (!newPassword || newPassword.length < 8 || !/\d/.test(newPassword)) {
      return { success: false, error: 'Password must be at least 8 characters long and contain at least one number.' };
    }

    const user = db.users.find((u) => u.id === record.userId);
    if (!user) {
      return { success: false, error: 'User not found.' };
    }

    user.passwordHash = bcrypt.hashSync(newPassword, 8);
    (user as any).sessionVersion = ((user as any).sessionVersion || 1) + 1;
    this.resetTokens.delete(code);
    db.save();

    return { success: true };
  }

  public static changePassword(
    userId: string,
    currentPassword: string | undefined,
    newPassword: string
  ): { success: boolean; message?: string; error?: string } {
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

    if (!newPassword || newPassword.length < 8 || !/\d/.test(newPassword)) {
      return {
        success: false,
        error: 'New password must be at least 8 characters long and contain at least one number.',
      };
    }

    user.passwordHash = bcrypt.hashSync(newPassword, 8);
    (user as any).sessionVersion = ((user as any).sessionVersion || 1) + 1;
    db.save();

    return { success: true, message: 'Password updated successfully.' };
  }

  public static async requestEmailVerification(userId: string): Promise<{ success: boolean; message: string }> {
    const user = db.users.find((u) => u.id === userId);
    if (!user) return { success: false, message: 'User not found.' };

    const code = crypto.randomInt(100000, 1000000).toString();
    this.emailVerifyTokens.set(code, {
      userId: user.id,
      email: user.email,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV EMAIL VERIFY] Verification code for ${user.email}: ${code}`);
    }

    return { success: true, message: 'Verification code sent.' };
  }

  public static confirmEmailVerification(code: string): { success: boolean; error?: string } {
    const record = this.emailVerifyTokens.get(code);
    if (!record || record.expiresAt < Date.now()) {
      return { success: false, error: 'Invalid or expired verification code.' };
    }

    const user = db.users.find((u) => u.id === record.userId);
    if (user) {
      (user as any).emailVerified = true;
      (user as any).emailVerifiedAt = new Date().toISOString();
      db.save();
    }

    this.emailVerifyTokens.delete(code);
    return { success: true };
  }

  public static async requestPhoneVerification(phoneOrUserId: string, authenticatedUserId?: string): Promise<{ success: boolean; message: string }> {
    const clean = phoneOrUserId.trim();
    const user = (authenticatedUserId ? db.users.find((u) => u.id === authenticatedUserId) : null) ||
      db.users.find((u) => u.id === clean || (u.phone && u.phone.replace(/\s+/g, '') === clean.replace(/\s+/g, '')));
    const targetPhone = user?.phone ? user.phone : clean;

    const code = crypto.randomInt(100000, 1000000).toString();
    const phoneKey = targetPhone.replace(/\s+/g, '');
    const userKey = user ? user.id : phoneKey;

    const tokenRecord = {
      userId: user?.id || authenticatedUserId,
      phone: targetPhone,
      code,
      expiresAt: Date.now() + 15 * 60 * 1000,
    };

    this.phoneVerifyTokens.set(userKey, tokenRecord);
    if (userKey !== phoneKey) {
      this.phoneVerifyTokens.set(phoneKey, tokenRecord);
    }

    await sendSms(targetPhone, `Your Fixhub verification code is: ${code}. Valid for 15 minutes.`);

    return { success: true, message: 'Verification code sent via SMS.' };
  }

  public static confirmPhoneVerification(phoneOrUserId: string, code: string, authenticatedUserId?: string): { success: boolean; user?: User; error?: string } {
    const clean = phoneOrUserId.trim();
    const phoneKey = clean.replace(/\s+/g, '');

    let record = this.phoneVerifyTokens.get(clean) || this.phoneVerifyTokens.get(phoneKey);
    if (!record && authenticatedUserId) {
      record = this.phoneVerifyTokens.get(authenticatedUserId);
    }

    if (!record || record.code !== code.trim() || record.expiresAt < Date.now()) {
      return { success: false, error: 'Invalid or expired phone verification code.' };
    }

    const targetUserId = record.userId || authenticatedUserId;
    let user = targetUserId ? db.users.find((u) => u.id === targetUserId) : null;
    if (!user) {
      user = db.users.find((u) => u.id === clean || u.phone.replace(/\s+/g, '') === phoneKey);
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

    this.phoneVerifyTokens.delete(clean);
    this.phoneVerifyTokens.delete(phoneKey);
    if (record.userId) {
      this.phoneVerifyTokens.delete(record.userId);
    }
    if (authenticatedUserId) {
      this.phoneVerifyTokens.delete(authenticatedUserId);
    }

    const safeUser: User | undefined = user ? {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      phoneVerified: true,
      phoneVerifiedAt: (user as any).phoneVerifiedAt,
      emailVerified: (user as any).emailVerified,
      emailVerifiedAt: (user as any).emailVerifiedAt,
    } : undefined;

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
    const user = db.users.find(
      (u) => u.email.toLowerCase() === cleanIdentifier || u.phone.replace(/\s+/g, '') === cleanIdentifier.replace(/\s+/g, '')
    );

    if (!user) {
      return { error: 'Invalid credentials. User not found.' };
    }

    // A password is ALWAYS required on this path. Social (Google) logins go through
    // AuthService.socialLogin / POST /auth/social-login, which verify a provider token instead.
    if (typeof password !== 'string' || password.length === 0) {
      return { error: 'Password is required.' };
    }
    if (!user.passwordHash || !bcrypt.compareSync(password, user.passwordHash)) {
      return { error: 'Invalid password. Please check and retry.' };
    }

    if (user.role === 'technician') {
      this.ensureTechnicianProfile(user);
    } else if (user.role === 'customer') {
      this.ensureCustomerProfile(user);
    }

    const token = this.generateToken(user, isBorrowedDevice);
    const customerProfile = db.customerProfiles.find((c) => c.userId === user.id);
    const technicianProfile = db.technicianProfiles.find((t) => t.userId === user.id || (t as any).id === user.id);

    const safeUser: User = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      isBorrowedDeviceSession: isBorrowedDevice,
    };

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
    if (!data.password || data.password.length < 8 || !/\d/.test(data.password)) {
      return { error: 'Password must be at least 8 characters long and contain at least one number.' };
    }

    const existing = db.users.find((u) => u.email.toLowerCase() === data.email.trim().toLowerCase() || u.phone === data.phone.trim());
    if (existing) {
      return { error: 'An account with this email or phone already exists.' };
    }

    const userId = `usr_cust_${Date.now()}`;
    const passwordHash = bcrypt.hashSync(data.password, 8);
    const now = new Date().toISOString();

    const newUser = {
      id: userId,
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
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

    const safeUser: User = {
      id: newUser.id,
      email: newUser.email,
      phone: newUser.phone,
      name: newUser.name,
      role: newUser.role,
      avatarUrl: newUser.avatarUrl,
      createdAt: newUser.createdAt,
      isBorrowedDeviceSession: !!data.isBorrowedDevice,
      phoneVerified: false,
      emailVerified: false,
    };

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
    if (!data.password || data.password.length < 8 || !/\d/.test(data.password)) {
      return { error: 'Password must be at least 8 characters long and contain at least one number.' };
    }

    const existing = db.users.find((u) => u.email.toLowerCase() === data.email.trim().toLowerCase() || u.phone === data.phone.trim());
    if (existing) {
      return { error: 'An account with this email or phone already exists.' };
    }

    const userId = `usr_tech_${Date.now()}`;
    const passwordHash = bcrypt.hashSync(data.password, 8);
    const now = new Date().toISOString();

    const newUser = {
      id: userId,
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
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
      phone: data.phone.trim(),
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

    const safeUser: User = {
      id: newUser.id,
      email: newUser.email,
      phone: newUser.phone,
      name: newUser.name,
      role: newUser.role,
      avatarUrl: newUser.avatarUrl,
      createdAt: newUser.createdAt,
      phoneVerified: false,
      emailVerified: false,
    };

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

    const safeUser: User = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      phoneVerified: Boolean((user as any).phoneVerified),
      phoneVerifiedAt: (user as any).phoneVerifiedAt,
      emailVerified: Boolean((user as any).emailVerified),
      emailVerifiedAt: (user as any).emailVerifiedAt,
      authProvider: (user as any).authProvider || 'local',
    };

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
    const safeUser: User = {
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
      authProvider: user.authProvider,
    };

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
