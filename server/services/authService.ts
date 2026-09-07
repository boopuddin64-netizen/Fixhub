import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { User, UserRole, CustomerProfile, TechnicianProfile } from '../../src/types/index';

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
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      return decoded;
    } catch {
      return null;
    }
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
    const existing = db.users.find((u) => u.email.toLowerCase() === data.email.trim().toLowerCase() || u.phone === data.phone.trim());
    if (existing) {
      return { error: 'An account with this email or phone already exists.' };
    }

    const userId = `usr_cust_${Date.now()}`;
    const passwordHash = bcrypt.hashSync(data.password || 'password123', 8);
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
    };

    db.users.push(newUser);

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

    const token = this.generateToken(newUser, !!data.isBorrowedDevice);

    const safeUser: User = {
      id: newUser.id,
      email: newUser.email,
      phone: newUser.phone,
      name: newUser.name,
      role: newUser.role,
      avatarUrl: newUser.avatarUrl,
      createdAt: newUser.createdAt,
      isBorrowedDeviceSession: !!data.isBorrowedDevice,
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
    const existing = db.users.find((u) => u.email.toLowerCase() === data.email.trim().toLowerCase() || u.phone === data.phone.trim());
    if (existing) {
      return { error: 'An account with this email or phone already exists.' };
    }

    const userId = `usr_tech_${Date.now()}`;
    const passwordHash = bcrypt.hashSync(data.password || 'password123', 8);
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
    };

    db.users.push(newUser);

    const newTechProfile: TechnicianProfile = {
      userId,
      businessName: data.businessName.trim(),
      bio: `Professional mobile phone repair center in ${data.area || data.city || 'Lagos'}. Specializing in screen, battery, and motherboard repairs.`,
      shopLocation: {
        lat: 6.5355,
        lng: 3.3644,
        address: data.shopAddress,
        landmark: data.landmark || '',
        area: data.area || 'Lagos Central',
        city: data.city || 'Lagos',
        state: data.state || 'Lagos State',
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

    const token = this.generateToken(user);
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
    };

    return {
      token,
      user: safeUser,
      customerProfile,
      technicianProfile,
    };
  }
}
