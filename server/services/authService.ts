import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { User, UserRole, CustomerProfile, TechnicianProfile } from '../../src/types/index';
import { sendSms } from './smsService';

const JWT_SECRET = process.env.JWT_SECRET || 'fixhub-dev-secret-key-production-change-me';

export interface AuthSession {
  token: string;
  user: User;
  customerProfile?: CustomerProfile;
  technicianProfile?: TechnicianProfile;
}

export class AuthService {
  public static generateToken(user: User, isBorrowedDevice = false): string {
    const expiresIn = isBorrowedDevice ? '2h' : '30d'; // Shorter expiry on borrowed devices
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        isBorrowedDevice,
      },
      JWT_SECRET,
      { expiresIn }
    );
  }

  public static verifyToken(token: string): { id: string; email: string; role: UserRole; isBorrowedDevice?: boolean } | null {
    if (this.isTokenRevoked(token)) return null;
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
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
      (u) => u.email.toLowerCase() === clean || u.phone.replace(/\s+/g, '') === clean.replace(/\s+/g, '')
    );
    if (!user) {
      return { success: true, message: 'If an account exists with this credential, a password reset code has been sent.' };
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
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
    this.resetTokens.delete(code);
    db.save();

    return { success: true };
  }

  public static async requestEmailVerification(userId: string): Promise<{ success: boolean; message: string }> {
    const user = db.users.find((u) => u.id === userId);
    if (!user) return { success: false, message: 'User not found.' };

    const code = Math.floor(100000 + Math.random() * 900000).toString();
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

  public static async requestPhoneVerification(phoneOrUserId: string): Promise<{ success: boolean; message: string }> {
    const clean = phoneOrUserId.trim();
    const user = db.users.find((u) => u.id === clean || u.phone.replace(/\s+/g, '') === clean.replace(/\s+/g, ''));
    const targetPhone = user ? user.phone : clean;

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const key = user ? user.id : targetPhone.replace(/\s+/g, '');

    this.phoneVerifyTokens.set(key, {
      userId: user?.id,
      phone: targetPhone,
      code,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    await sendSms(targetPhone, `Your Fixhub verification code is: ${code}. Valid for 15 minutes.`);

    return { success: true, message: 'Verification code sent via SMS.' };
  }

  public static confirmPhoneVerification(phoneOrUserId: string, code: string): { success: boolean; user?: User; error?: string } {
    const clean = phoneOrUserId.trim();
    const user = db.users.find((u) => u.id === clean || u.phone.replace(/\s+/g, '') === clean.replace(/\s+/g, ''));
    const key = user ? user.id : clean.replace(/\s+/g, '');

    const record = this.phoneVerifyTokens.get(key);
    if (!record || record.code !== code.trim() || record.expiresAt < Date.now()) {
      return { success: false, error: 'Invalid or expired phone verification code.' };
    }

    if (user) {
      if (!user.phone && record.phone) {
        user.phone = record.phone;
      }
      (user as any).phoneVerified = true;
      (user as any).phoneVerifiedAt = new Date().toISOString();
      db.save();
    }

    this.phoneVerifyTokens.delete(key);

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

  public static login(emailOrPhone: string, password?: string, isBorrowedDevice = false): AuthSession | { error: string } {
    const cleanIdentifier = emailOrPhone.trim().toLowerCase();
    const user = db.users.find(
      (u) => u.email.toLowerCase() === cleanIdentifier || u.phone.replace(/\s+/g, '') === cleanIdentifier.replace(/\s+/g, '')
    );

    if (!user) {
      return { error: 'Invalid credentials. User not found.' };
    }

    if (password) {
      const valid = bcrypt.compareSync(password, user.passwordHash);
      if (!valid) {
        return { error: 'Invalid password. Please check and retry.' };
      }
    }

    const token = this.generateToken(user, isBorrowedDevice);
    const customerProfile = db.customerProfiles.find((c) => c.userId === user.id);
    const technicianProfile = db.technicianProfiles.find((t) => t.userId === user.id);

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

    const token = this.generateToken(user as any);
    const customerProfile = db.customerProfiles.find((c) => c.userId === user.id);
    const technicianProfile = db.technicianProfiles.find((t) => t.userId === user.id);

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
    provider: 'google' | 'apple' | 'facebook';
    token: string;
    role: UserRole;
  }): Promise<{ success: boolean; token?: string; user?: User; error?: string }> {
    const { provider, token, role } = params;
    if (!token || !token.trim()) {
      return { success: false, error: 'OAuth token is required.' };
    }

    let verifiedIdentity: { email: string; name?: string };

    if (provider === 'google') {
      const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) {
        return { success: false, error: 'Google OAuth is not configured on this server (GOOGLE_CLIENT_ID missing).' };
      }
      try {
        const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token.trim())}`);
        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as any;
          return { success: false, error: errData?.error_description || 'Invalid or expired Google token.' };
        }
        const payload = (await res.json()) as any;
        if (payload.aud !== clientId && !process.env.SKIP_AUD_CHECK) {
          return { success: false, error: 'Google token audience mismatch.' };
        }
        if (!payload.email) {
          return { success: false, error: 'No verified email returned from Google.' };
        }
        verifiedIdentity = { email: payload.email, name: payload.name || payload.email.split('@')[0] };
      } catch (err: any) {
        return { success: false, error: `Google verification network error: ${err.message}` };
      }
    } else if (provider === 'apple') {
      const clientId = process.env.APPLE_CLIENT_ID || process.env.VITE_APPLE_CLIENT_ID;
      if (!clientId) {
        return { success: false, error: 'Apple Sign-In is not configured on this server (APPLE_CLIENT_ID missing).' };
      }
      return { success: false, error: 'Apple Sign-In is not configured: Apple Developer keys and credentials are not configured in this environment.' };
    } else if (provider === 'facebook') {
      const appId = process.env.FACEBOOK_APP_ID || process.env.VITE_FACEBOOK_APP_ID;
      if (!appId) {
        return { success: false, error: 'Facebook Login is not configured on this server (FACEBOOK_APP_ID missing).' };
      }
      try {
        const res = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(token.trim())}`);
        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as any;
          return { success: false, error: errData?.error?.message || 'Invalid or expired Facebook access token.' };
        }
        const data = (await res.json()) as any;
        if (!data.email) {
          return { success: false, error: 'Facebook account does not have a verified email address.' };
        }
        verifiedIdentity = { email: data.email, name: data.name || data.email.split('@')[0] };
      } catch (err: any) {
        return { success: false, error: `Facebook verification network error: ${err.message}` };
      }
    } else {
      return { success: false, error: 'Unsupported social provider.' };
    }

    const cleanEmail = verifiedIdentity.email.toLowerCase().trim();
    let user = db.users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (user) {
      user.emailVerified = true;
      user.emailVerifiedAt = user.emailVerifiedAt || new Date().toISOString();
      if (!user.authProvider || user.authProvider === 'local') {
        user.authProvider = provider;
      }
      db.save();
    } else {
      const userId = `usr_social_${Date.now()}`;
      user = {
        id: userId,
        email: cleanEmail,
        phone: '',
        name: verifiedIdentity.name || cleanEmail.split('@')[0],
        role,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(verifiedIdentity.name || cleanEmail)}`,
        createdAt: new Date().toISOString(),
        emailVerified: true,
        emailVerifiedAt: new Date().toISOString(),
        phoneVerified: false,
        authProvider: provider,
      } as any;
      db.users.push(user as any);

      if (role === 'customer') {
        db.customerProfiles.push({
          userId,
          savedLocations: [],
          totalRepairsCount: 0,
          activeRepairsCount: 0,
        });
      } else if (role === 'technician') {
        db.technicianProfiles.push({
          userId,
          businessName: `${user.name}'s Workshop`,
          bio: 'Professional repair workshop in Port Harcourt, Rivers State.',
          shopLocation: {
            lat: 4.8156,
            lng: 7.0498,
            address: 'Port Harcourt, Rivers State',
            landmark: '',
            area: 'Port Harcourt',
            city: 'Port Harcourt',
            state: 'Rivers State',
          },
          serviceRadiusKm: 15,
          businessHours: 'Mon - Sat: 8:30 AM - 6:30 PM',
          yearsExperience: 2,
          phone: '',
          avatarUrl: user.avatarUrl,
          shopPhotos: [],
          supportedBrands: ['Apple', 'Samsung', 'Tecno', 'Infinix'],
          supportedCategories: ['screen_damaged', 'battery_problem'],
          availability: 'AVAILABLE',
          rating: 0,
          reviewCount: 0,
          completedJobs: 0,
          quoteAccuracyScore: 100,
          cancellationRate: 0,
          averageResponseMinutes: 15,
          trustScore: 70,
          trustLevel: 'NEW',
          verificationStatus: {
            basic: true,
            locationConfirmed: false,
            identityVerified: false,
            businessVerified: false,
            payoutVerified: false,
          },
        } as any);
      }
      db.save();
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

    return { success: true, token: sessionToken, user: safeUser };
  }
}
