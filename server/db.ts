import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import {
  User,
  CustomerProfile,
  TechnicianProfile,
  DeviceBrand,
  DeviceFamily,
  DeviceModel,
  CustomerDevice,
  RepairIssueOption,
  RepairRequest,
  RepairQuote,
  RepairJob,
  TechnicianPart,
  PaymentTransaction,
  Review,
  AuditLog,
  NotificationItem,
  MessageItem,
  WarrantyRecord,
  RepairIssue,
  RepairRequestDraft,
  RepairRequestAttachment,
} from '../src/types/index';
import { seedBrands, seedFamilies, seedModels } from './data/deviceCatalogData';
import { standardRepairIssues } from './data/repairIssuesData';

export interface DatabaseSchema {
  version: number;
  users: (User & { passwordHash: string })[];
  customerProfiles: CustomerProfile[];
  technicianProfiles: TechnicianProfile[];
  deviceBrands: DeviceBrand[];
  deviceFamilies: DeviceFamily[];
  deviceModels: DeviceModel[];
  customerDevices: CustomerDevice[];
  repairIssues: RepairIssueOption[];
  repairIssueCatalog: RepairIssue[];
  drafts: RepairRequestDraft[];
  repairRequests: RepairRequest[];
  repairQuotes: RepairQuote[];
  repairJobs: RepairJob[];
  technicianParts: TechnicianPart[];
  payments: PaymentTransaction[];
  warranties: WarrantyRecord[];
  reviews: Review[];
  auditLogs: AuditLog[];
  notifications: NotificationItem[];
  messages: MessageItem[];
  riskEvents: Array<{
    id: string;
    actorId: string;
    eventType: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    metadata: Record<string, unknown>;
    reviewed: boolean;
    timestamp: string;
  }>;
}

const DB_FILE_PATH = path.resolve(process.cwd(), process.env.DATA_STORAGE_PATH || './data/fixhub.db.json');

// Ensure directory exists
function ensureDbDir() {
  const dir = path.dirname(DB_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Default Seed Data
function getInitialSeedData(): DatabaseSchema {
  const defaultPasswordHash = bcrypt.hashSync('password123', 8);
  const now = new Date().toISOString();
  const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Brands, Families, Models
  const deviceBrands: DeviceBrand[] = [...seedBrands];
  const deviceFamilies: DeviceFamily[] = [...seedFamilies];
  const deviceModels: DeviceModel[] = [...seedModels];

  // Customer Saved Devices
  const customerDevices: CustomerDevice[] = [
    {
      id: 'cdev_demo_1',
      customerId: 'usr_customer_1',
      deviceModelId: 'model_ip13',
      brandName: 'Apple',
      modelName: 'iPhone 13',
      deviceType: 'PHONE',
      nickname: 'Daily Driver',
      color: 'Midnight Blue',
      storage: '128GB',
      isPrimary: true,
      catalogMatch: true,
      createdAt: oneMonthAgo,
      updatedAt: pastDate,
    },
    {
      id: 'cdev_demo_2',
      customerId: 'usr_customer_1',
      deviceModelId: 'model_ipadair4',
      brandName: 'Apple',
      modelName: 'iPad Air 10.9-inch (4th generation)',
      deviceType: 'TABLET',
      nickname: 'Work iPad',
      color: 'Space Gray',
      storage: '64GB',
      isPrimary: false,
      catalogMatch: true,
      createdAt: pastDate,
      updatedAt: pastDate,
    },
  ];

  // Common Repair Issues
  const repairIssues: RepairIssueOption[] = [
    { id: 'screen_damaged', label: 'Screen Cracked / Broken Glass', description: 'Outer glass cracked but touch and display still function', iconName: 'Smartphone', estimatedLaborMinutes: 45, typicalCostRangeNaira: [18000, 85000] },
    { id: 'screen_not_displaying', label: 'Screen Blank / Black / Lines', description: 'OLED/LCD display dead, showing green/purple lines or blank', iconName: 'Tv', estimatedLaborMinutes: 50, typicalCostRangeNaira: [35000, 160000] },
    { id: 'battery_problem', label: 'Battery Draining Fast / Swollen', description: 'Battery health degraded, fast drain, or expanding back cover', iconName: 'BatteryCharging', estimatedLaborMinutes: 30, typicalCostRangeNaira: [12000, 45000] },
    { id: 'charging_problem', label: 'Charging Port Faulty / Loose', description: 'Phone not charging, cable slips out, or slow charging error', iconName: 'Zap', estimatedLaborMinutes: 35, typicalCostRangeNaira: [8000, 25000] },
    { id: 'no_power', label: 'Phone Dead / Will Not Power On', description: 'Completely unresponsive to power button and charger', iconName: 'PowerOff', estimatedLaborMinutes: 90, typicalCostRangeNaira: [15000, 65000] },
    { id: 'camera_problem', label: 'Camera Blurry / Cracked Lens', description: 'Rear or front camera blurry, black screen, or broken lens', iconName: 'Camera', estimatedLaborMinutes: 40, typicalCostRangeNaira: [15000, 55000] },
    { id: 'speaker_problem', label: 'Earpiece or Loudspeaker Low', description: 'Low call volume, muffled sound, or crackling audio', iconName: 'Volume2', estimatedLaborMinutes: 30, typicalCostRangeNaira: [7000, 22000] },
    { id: 'mic_problem', label: 'Microphone Problem', description: 'Callers cannot hear you, voice notes have static or no sound', iconName: 'Mic', estimatedLaborMinutes: 35, typicalCostRangeNaira: [7000, 20000] },
    { id: 'water_damage', label: 'Water / Liquid Damage', description: 'Dropped in water, soaked, or corrosion cleanup required', iconName: 'Droplets', estimatedLaborMinutes: 120, typicalCostRangeNaira: [15000, 70000] },
    { id: 'body_glass_damage', label: 'Back Glass / Housing Damaged', description: 'Back panel shattered, frame bent, or side buttons stuck', iconName: 'ShieldAlert', estimatedLaborMinutes: 60, typicalCostRangeNaira: [14000, 55000] },
    { id: 'software_problem', label: 'Software Bootloop / OS Error', description: 'Stuck on logo, crashing apps, or firmware flashing needed', iconName: 'Cpu', estimatedLaborMinutes: 45, typicalCostRangeNaira: [6000, 25000] },
    { id: 'overheating', label: 'Severe Overheating', description: 'Device gets dangerously hot during normal use or charging', iconName: 'Flame', estimatedLaborMinutes: 60, typicalCostRangeNaira: [10000, 35000] },
    { id: 'other', label: 'Other Issue / Unknown', description: 'Specialized issue or diagnostic needed by certified tech', iconName: 'HelpCircle', estimatedLaborMinutes: 60, typicalCostRangeNaira: [8000, 40000] },
  ];

  // Users
  const users: (User & { passwordHash: string })[] = [
    {
      id: 'usr_customer_1',
      email: 'customer@test.fixhub.local',
      phone: '+234 803 123 4567',
      name: 'Tunde Adebayo',
      role: 'customer',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      createdAt: oneMonthAgo,
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr_customer_2',
      email: 'ngozi@test.fixhub.local',
      phone: '+234 812 987 6543',
      name: 'Ngozi Eze',
      role: 'customer',
      avatarUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&auto=format&fit=crop&q=80',
      createdAt: oneMonthAgo,
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr_tech_1',
      email: 'technician@test.fixhub.local',
      phone: '+234 802 555 0101',
      name: 'Emeka Okafor',
      role: 'technician',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      createdAt: oneMonthAgo,
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr_tech_2',
      email: 'kola@test.fixhub.local',
      phone: '+234 809 333 4455',
      name: 'Kolawole Balogun',
      role: 'technician',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      createdAt: oneMonthAgo,
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr_tech_3',
      email: 'fatima@test.fixhub.local',
      phone: '+234 814 777 8899',
      name: 'Fatima Ibrahim',
      role: 'technician',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      createdAt: oneMonthAgo,
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr_tech_4',
      email: 'chidi@test.fixhub.local',
      phone: '+234 805 111 2233',
      name: 'Chidi Nnamdi',
      role: 'technician',
      avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
      createdAt: oneMonthAgo,
      passwordHash: defaultPasswordHash,
    },
  ];

  // Customer Profiles
  const customerProfiles: CustomerProfile[] = [
    {
      userId: 'usr_customer_1',
      totalRepairsCount: 2,
      activeRepairsCount: 1,
      emergencyContactPhone: '+234 809 999 8888',
      savedLocations: [
        {
          lat: 6.5964,
          lng: 3.3421,
          address: '14 Allen Avenue, Ikeja',
          landmark: 'Opposite Oshopey Plaza',
          area: 'Ikeja',
          city: 'Lagos',
          state: 'Lagos State',
        },
        {
          lat: 6.4281,
          lng: 3.4219,
          address: 'Plot 12 Adetokunbo Ademola Street, Victoria Island',
          landmark: 'Near Eko Hotel',
          area: 'Victoria Island',
          city: 'Lagos',
          state: 'Lagos State',
        },
      ],
      defaultLocation: {
        lat: 6.5964,
        lng: 3.3421,
        address: '14 Allen Avenue, Ikeja',
        landmark: 'Opposite Oshopey Plaza',
        area: 'Ikeja',
        city: 'Lagos',
        state: 'Lagos State',
      },
    },
    {
      userId: 'usr_customer_2',
      totalRepairsCount: 1,
      activeRepairsCount: 0,
      savedLocations: [
        {
          lat: 6.5158,
          lng: 3.3718,
          address: 'Commercial Avenue, Sabo Yaba',
          landmark: 'Close to E-Center',
          area: 'Yaba',
          city: 'Lagos',
          state: 'Lagos State',
        },
      ],
    },
  ];

  // Technician Profiles
  const technicianProfiles: TechnicianProfile[] = [
    {
      userId: 'usr_tech_1',
      businessName: 'Emeka Phone Labs & Micro-Soldering',
      bio: 'Apple Certified & Samsung Master Technician with 8+ years specializing in micro-soldering, motherboard recovery, and OLED screen calibration.',
      shopLocation: {
        lat: 6.5982,
        lng: 3.3438,
        address: 'Shop B12, Medical Road, Computer Village, Ikeja',
        landmark: 'Near Slot Building',
        area: 'Computer Village, Ikeja',
        city: 'Lagos',
        state: 'Lagos State',
      },
      serviceRadiusKm: 15,
      businessHours: 'Mon - Sat: 8:30 AM - 6:30 PM',
      yearsExperience: 8,
      phone: '+234 802 555 0101',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      shopPhotos: [
        'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&auto=format&fit=crop&q=80',
      ],
      supportedBrands: ['Apple', 'Samsung', 'Google', 'OnePlus'],
      supportedCategories: ['screen_damaged', 'screen_not_displaying', 'battery_problem', 'charging_problem', 'no_power', 'camera_problem', 'water_damage', 'body_glass_damage'],
      availability: 'AVAILABLE',
      rating: 4.9,
      reviewCount: 128,
      completedJobs: 214,
      quoteAccuracyScore: 98.4,
      cancellationRate: 1.2,
      averageResponseMinutes: 12,
      trustScore: 96,
      trustLevel: 'HIGHLY_TRUSTED',
      verificationStatus: {
        basic: true,
        locationConfirmed: true,
        identityVerified: true,
        businessVerified: true,
        payoutVerified: true,
      },
      bankDetails: {
        bankName: 'Guaranty Trust Bank (GTBank)',
        accountNumber: '0123456789',
        accountName: 'Emeka Okafor Engineering Ltd',
        verified: true,
      },
    },
    {
      userId: 'usr_tech_2',
      businessName: 'Kola Tech Solutions (VI Hub)',
      bio: 'Premium repair studio in Victoria Island. High-grade OEM components for iPhones, Galaxies, and flagship Androids with up to 6 months warranty.',
      shopLocation: {
        lat: 6.4328,
        lng: 3.4284,
        address: 'Suite 4, Silverbird Galleria Plaza, Ahmadu Bello Way, Victoria Island',
        landmark: 'Beside Silverbird Cinema',
        area: 'Victoria Island',
        city: 'Lagos',
        state: 'Lagos State',
      },
      serviceRadiusKm: 20,
      businessHours: 'Mon - Sun: 9:00 AM - 7:00 PM',
      yearsExperience: 6,
      phone: '+234 809 333 4455',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      shopPhotos: [
        'https://images.unsplash.com/photo-1588508065123-287b28e013da?w=500&auto=format&fit=crop&q=80',
      ],
      supportedBrands: ['Apple', 'Samsung', 'Google', 'Xiaomi', 'OnePlus'],
      supportedCategories: ['screen_damaged', 'screen_not_displaying', 'battery_problem', 'charging_problem', 'camera_problem', 'speaker_problem', 'body_glass_damage', 'software_problem'],
      availability: 'AVAILABLE',
      rating: 4.8,
      reviewCount: 94,
      completedJobs: 165,
      quoteAccuracyScore: 97.1,
      cancellationRate: 2.0,
      averageResponseMinutes: 18,
      trustScore: 94,
      trustLevel: 'HIGHLY_TRUSTED',
      verificationStatus: {
        basic: true,
        locationConfirmed: true,
        identityVerified: true,
        businessVerified: true,
        payoutVerified: true,
      },
      bankDetails: {
        bankName: 'Access Bank',
        accountNumber: '0987654321',
        accountName: 'Kolawole Tech Innovations',
        verified: true,
      },
    },
    {
      userId: 'usr_tech_3',
      businessName: 'Fatima Express Fixes (Yaba Tech Node)',
      bio: 'Fastest turnaround in Yaba tech corridor. Screen & battery replacements in under 45 minutes while you wait. Certified for Tecno, Infinix, Samsung & iPhones.',
      shopLocation: {
        lat: 6.5165,
        lng: 3.3725,
        address: '18 Herbert Macaulay Way, Yaba',
        landmark: 'Opposite Ozone Cinemas / E-Center',
        area: 'Yaba',
        city: 'Lagos',
        state: 'Lagos State',
      },
      serviceRadiusKm: 12,
      businessHours: 'Mon - Sat: 8:00 AM - 6:00 PM',
      yearsExperience: 5,
      phone: '+234 814 777 8899',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      shopPhotos: [
        'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=80',
      ],
      supportedBrands: ['Tecno', 'Infinix', 'Samsung', 'Xiaomi', 'Apple'],
      supportedCategories: ['screen_damaged', 'screen_not_displaying', 'battery_problem', 'charging_problem', 'mic_problem', 'speaker_problem', 'software_problem'],
      availability: 'AVAILABLE',
      rating: 4.7,
      reviewCount: 76,
      completedJobs: 142,
      quoteAccuracyScore: 96.0,
      cancellationRate: 1.5,
      averageResponseMinutes: 8,
      trustScore: 91,
      trustLevel: 'TRUSTED',
      verificationStatus: {
        basic: true,
        locationConfirmed: true,
        identityVerified: true,
        businessVerified: true,
        payoutVerified: true,
      },
      bankDetails: {
        bankName: 'Zenith Bank',
        accountNumber: '2109876543',
        accountName: 'Fatima Ibrahim Repairs',
        verified: true,
      },
    },
    {
      userId: 'usr_tech_4',
      businessName: 'Chidi Hardware & Micro-Electronics (Surulere)',
      bio: 'Precision hardware engineer in Surulere. Specializing in water damage restoration, circuit tracing, and battery rejuvenation.',
      shopLocation: {
        lat: 6.5012,
        lng: 3.3582,
        address: '42 Adeniran Ogunsanya Street, Surulere',
        landmark: 'Near Adeniran Ogunsanya Mall',
        area: 'Surulere',
        city: 'Lagos',
        state: 'Lagos State',
      },
      serviceRadiusKm: 14,
      businessHours: 'Mon - Sat: 9:00 AM - 6:00 PM',
      yearsExperience: 4,
      phone: '+234 805 111 2233',
      avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
      shopPhotos: [],
      supportedBrands: ['Apple', 'Samsung', 'Tecno', 'Infinix', 'OnePlus'],
      supportedCategories: ['screen_damaged', 'battery_problem', 'water_damage', 'no_power', 'charging_problem'],
      availability: 'AVAILABLE',
      rating: 4.6,
      reviewCount: 42,
      completedJobs: 88,
      quoteAccuracyScore: 94.5,
      cancellationRate: 3.2,
      averageResponseMinutes: 25,
      trustScore: 88,
      trustLevel: 'ESTABLISHED',
      verificationStatus: {
        basic: true,
        locationConfirmed: true,
        identityVerified: true,
        businessVerified: false,
        payoutVerified: true,
      },
    },
  ];

  // Technician Parts Catalog
  const technicianParts: TechnicianPart[] = [
    {
      id: 'part_1',
      technicianId: 'usr_tech_1',
      name: 'iPhone 13 OLED Display Panel (Original OEM)',
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 13',
      quality: 'ORIGINAL_OEM',
      priceNaira: 75000,
      inStockCount: 4,
      warrantyDays: 90,
      photoUrl: 'https://images.unsplash.com/photo-1588508065123-287b28e013da?w=400&auto=format&fit=crop&q=80',
    },
    {
      id: 'part_2',
      technicianId: 'usr_tech_1',
      name: 'iPhone 13 Premium Hard OLED Screen',
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 13',
      quality: 'PREMIUM_AFTERMARKET',
      priceNaira: 48000,
      inStockCount: 8,
      warrantyDays: 60,
    },
    {
      id: 'part_3',
      technicianId: 'usr_tech_1',
      name: 'iPhone 13 Original Capacity Battery (3240 mAh)',
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 13',
      quality: 'ORIGINAL_OEM',
      priceNaira: 24000,
      inStockCount: 6,
      warrantyDays: 90,
    },
    {
      id: 'part_4',
      technicianId: 'usr_tech_1',
      name: 'Galaxy S23 Dynamic AMOLED 2X Screen Assembly',
      deviceBrand: 'Samsung',
      deviceModel: 'Galaxy S23',
      quality: 'ORIGINAL_OEM',
      priceNaira: 88000,
      inStockCount: 3,
      warrantyDays: 90,
    },
    {
      id: 'part_5',
      technicianId: 'usr_tech_2',
      name: 'iPhone 14 Pro Original Retina XDR Screen',
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 14 Pro',
      quality: 'ORIGINAL_OEM',
      priceNaira: 145000,
      inStockCount: 2,
      warrantyDays: 120,
    },
    {
      id: 'part_6',
      technicianId: 'usr_tech_3',
      name: 'Tecno Camon 30 Pro AMOLED Display',
      deviceBrand: 'Tecno',
      deviceModel: 'Camon 30 Pro 5G',
      quality: 'ORIGINAL_OEM',
      priceNaira: 38000,
      inStockCount: 5,
      warrantyDays: 60,
    },
  ];

  // Seed Repair Requests
  const repairRequests: RepairRequest[] = [
    {
      id: 'req_demo_open',
      customerId: 'usr_customer_1',
      customerName: 'Tunde Adebayo',
      customerPhone: '+234 803 123 4567',
      customerLocation: {
        lat: 6.5964,
        lng: 3.3421,
        address: '14 Allen Avenue, Ikeja',
        landmark: 'Opposite Oshopey Plaza',
        area: 'Ikeja',
        city: 'Lagos',
        state: 'Lagos State',
      },
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 13',
      issues: ['screen_damaged'],
      description: 'Front screen cracked after accidental drop. Touch responds normally.',
      photos: [
        'https://images.unsplash.com/photo-1596742578443-7682ef5251cd?w=600&auto=format&fit=crop&q=80',
      ],
      status: 'QUOTING',
      quotesCount: 1,
      createdAt: pastDate,
      updatedAt: now,
    },
    {
      id: 'req_demo_active',
      customerId: 'usr_customer_1',
      customerName: 'Tunde Adebayo',
      customerPhone: '+234 803 123 4567',
      customerLocation: {
        lat: 6.5964,
        lng: 3.3421,
        address: '14 Allen Avenue, Ikeja',
        landmark: 'Opposite Oshopey Plaza',
        area: 'Ikeja',
        city: 'Lagos',
        state: 'Lagos State',
      },
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 13',
      issues: ['screen_damaged'],
      description: 'Phone slipped off the dining table and the top glass shattered. Touch is still working, but glass is flaking near the front camera.',
      photos: [
        'https://images.unsplash.com/photo-1596742578443-7682ef5251cd?w=600&auto=format&fit=crop&q=80',
      ],
      status: 'REPAIR_IN_PROGRESS',
      quotesCount: 2,
      selectedTechnicianId: 'usr_tech_1',
      selectedQuoteId: 'quote_demo_1',
      createdAt: pastDate,
      updatedAt: now,
    },
    {
      id: 'req_demo_completed',
      customerId: 'usr_customer_1',
      customerName: 'Tunde Adebayo',
      customerPhone: '+234 803 123 4567',
      customerLocation: {
        lat: 6.5964,
        lng: 3.3421,
        address: '14 Allen Avenue, Ikeja',
        landmark: 'Opposite Oshopey Plaza',
        area: 'Ikeja',
        city: 'Lagos',
        state: 'Lagos State',
      },
      deviceBrand: 'Samsung',
      deviceModel: 'Galaxy S22 Ultra',
      issues: ['battery_problem'],
      description: 'Battery was dropping from 40% to 0% in minutes and back was slightly warm.',
      photos: [
        'https://images.unsplash.com/photo-1588508065123-287b28e013da?w=600&auto=format&fit=crop&q=80',
      ],
      status: 'COMPLETED',
      quotesCount: 3,
      selectedTechnicianId: 'usr_tech_1',
      selectedQuoteId: 'quote_demo_completed_1',
      createdAt: oneMonthAgo,
      updatedAt: pastDate,
    },
  ];

  // Seed Quotes
  const repairQuotes: RepairQuote[] = [
    {
      id: 'quote_demo_open_1',
      requestId: 'req_demo_open',
      technicianId: 'usr_tech_1',
      technicianName: 'Emeka Okafor',
      businessName: 'Emeka Phone Labs & Micro-Soldering',
      technicianPhone: '+234 802 555 0101',
      technicianAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      technicianRating: 4.9,
      technicianReviewsCount: 128,
      distanceKm: 0.8,
      partsCost: 45000,
      laborCost: 10000,
      otherCost: 0,
      totalAmount: 55000,
      estimatedTimeHours: 2,
      warrantyDays: 60,
      partsQuality: 'PREMIUM_AFTERMARKET',
      notes: 'Premium Hard OLED display replacement with 60-day warranty.',
      status: 'PENDING',
      createdAt: pastDate,
    },
    {
      id: 'quote_demo_1',
      requestId: 'req_demo_active',
      technicianId: 'usr_tech_1',
      technicianName: 'Emeka Okafor',
      businessName: 'Emeka Phone Labs & Micro-Soldering',
      technicianPhone: '+234 802 555 0101',
      technicianAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      technicianRating: 4.9,
      technicianReviewsCount: 128,
      distanceKm: 0.8,
      partsCost: 48000,
      laborCost: 12000,
      otherCost: 0,
      totalAmount: 60000,
      estimatedTimeHours: 2,
      warrantyDays: 60,
      partsQuality: 'PREMIUM_AFTERMARKET',
      notes: 'Premium Hard OLED display with true-tone programming and original water-seal gasket replacement included.',
      status: 'ACCEPTED',
      createdAt: pastDate,
    },
    {
      id: 'quote_demo_2',
      requestId: 'req_demo_active',
      technicianId: 'usr_tech_2',
      technicianName: 'Kolawole Balogun',
      businessName: 'Kola Tech Solutions (VI Hub)',
      technicianPhone: '+234 809 333 4455',
      technicianAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      technicianRating: 4.8,
      technicianReviewsCount: 94,
      distanceKm: 14.2,
      partsCost: 75000,
      laborCost: 15000,
      otherCost: 0,
      totalAmount: 90000,
      estimatedTimeHours: 3,
      warrantyDays: 90,
      partsQuality: 'ORIGINAL_OEM',
      notes: '100% Genuine Apple pulled display panel with factory oleophobic coating.',
      status: 'REJECTED',
      createdAt: pastDate,
    },
    {
      id: 'quote_demo_completed_1',
      requestId: 'req_demo_completed',
      technicianId: 'usr_tech_1',
      technicianName: 'Emeka Okafor',
      businessName: 'Emeka Phone Labs & Micro-Soldering',
      technicianPhone: '+234 802 555 0101',
      technicianAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      technicianRating: 4.9,
      technicianReviewsCount: 128,
      distanceKm: 0.8,
      partsCost: 22000,
      laborCost: 8000,
      otherCost: 0,
      totalAmount: 30000,
      estimatedTimeHours: 1,
      warrantyDays: 90,
      partsQuality: 'ORIGINAL_OEM',
      notes: 'Original Samsung Galaxy battery replacement with thermal pad reapplication.',
      status: 'ACCEPTED',
      createdAt: oneMonthAgo,
    },
  ];

  // Seed Repair Jobs
  const repairJobs: RepairJob[] = [
    {
      id: 'job_demo_booked',
      requestId: 'req_demo_open',
      quoteId: 'quote_demo_open_1',
      customerId: 'usr_customer_1',
      technicianId: 'usr_tech_1',
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 13',
      issues: ['screen_damaged'],
      status: 'BOOKED',
      dropOffCode: 'FX-1102',
      pickupCode: 'PK-4421',
      handoffQrToken: 'tok_fixhub_hand_1102991',
      originalQuoteAmount: 55000,
      finalAmount: 55000,
      platformFeeAmount: 4675,
      technicianPayoutAmount: 50325,
      partsUsed: [],
      createdAt: now,
      bookedAt: now,
      statusHistory: [
        { status: 'REQUESTED', timestamp: pastDate, actorRole: 'customer', note: 'Customer submitted repair request' },
        { status: 'QUOTING', timestamp: pastDate, actorRole: 'technician', note: 'Emeka submitted quote ₦55,000' },
        { status: 'QUOTE_ACCEPTED', timestamp: now, actorRole: 'customer', note: 'Quote accepted by customer' },
        { status: 'PAYMENT_CONFIRMED', timestamp: now, actorRole: 'customer', note: '₦55,000 secured in Escrow' },
        { status: 'BOOKED', timestamp: now, actorRole: 'customer', note: 'Repair booked. Awaiting physical intake.' },
      ],
    },
    {
      id: 'job_demo_active',
      requestId: 'req_demo_active',
      quoteId: 'quote_demo_1',
      customerId: 'usr_customer_1',
      technicianId: 'usr_tech_1',
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 13',
      issues: ['screen_damaged'],
      status: 'REPAIR_IN_PROGRESS',
      dropOffCode: 'FX-8492',
      pickupCode: 'PK-9314',
      handoffQrToken: 'tok_fixhub_hand_8492091',
      originalQuoteAmount: 60000,
      finalAmount: 60000,
      platformFeeAmount: 5100, // 8.5%
      technicianPayoutAmount: 54900,
      conditionReport: {
        timestamp: pastDate,
        frontCondition: 'CRACKED',
        backCondition: 'PERFECT',
        frameCondition: 'PRISTINE',
        screenPowersOn: true,
        touchResponsive: true,
        cameraWorking: true,
        existingDamageNotes: 'Diagonal fracture from top right corner. No frame bends or back scratches.',
        accessoriesReceived: ['Clear TPU Case'],
        photos: [
          'https://images.unsplash.com/photo-1596742578443-7682ef5251cd?w=600&auto=format&fit=crop&q=80',
        ],
        technicianNotes: 'Device passed initial digital check-in. Battery health tested at 88%. Proceeding with screen disassembly.',
        confirmedByCustomer: true,
      },
      partsUsed: [
        {
          id: 'part_rec_1',
          partId: 'part_2',
          partName: 'iPhone 13 Premium Hard OLED Screen',
          deviceModel: 'iPhone 13',
          quality: 'PREMIUM_AFTERMARKET',
          priceNaira: 48000,
          warrantyDays: 60,
          supplier: 'Prime Tech Component Lagos',
          beforePhotoUrl: 'https://images.unsplash.com/photo-1588508065123-287b28e013da?w=400&auto=format&fit=crop&q=80',
          afterPhotoUrl: 'https://images.unsplash.com/photo-1596742578443-7682ef5251cd?w=400&auto=format&fit=crop&q=80',
          installationTimestamp: now,
        },
      ],
      createdAt: pastDate,
      bookedAt: pastDate,
      receivedAt: pastDate,
      repairStartedAt: now,
      statusHistory: [
        { status: 'REQUESTED', timestamp: pastDate, actorRole: 'customer', note: 'Customer submitted repair request' },
        { status: 'QUOTING', timestamp: pastDate, actorRole: 'technician', note: 'Emeka submitted quote ₦60,000' },
        { status: 'QUOTE_ACCEPTED', timestamp: pastDate, actorRole: 'customer', note: 'Quote accepted by customer' },
        { status: 'PAYMENT_CONFIRMED', timestamp: pastDate, actorRole: 'customer', note: '₦60,000 held safely in Escrow' },
        { status: 'DEVICE_RECEIVED', timestamp: pastDate, actorRole: 'technician', note: 'Device checked in at shop with condition scan' },
        { status: 'DIAGNOSING', timestamp: pastDate, actorRole: 'technician', note: 'Diagnostics confirmed touch layer intact' },
        { status: 'REPAIR_IN_PROGRESS', timestamp: now, actorRole: 'technician', note: 'Installing Premium Hard OLED and water-seal gasket' },
      ],
    },
    {
      id: 'job_demo_completed',
      requestId: 'req_demo_completed',
      quoteId: 'quote_demo_completed_1',
      customerId: 'usr_customer_1',
      technicianId: 'usr_tech_1',
      deviceBrand: 'Samsung',
      deviceModel: 'Galaxy S22 Ultra',
      issues: ['battery_problem'],
      status: 'COMPLETED',
      dropOffCode: 'FX-3142',
      pickupCode: 'PK-7721',
      handoffQrToken: 'tok_fixhub_hand_3142091',
      originalQuoteAmount: 30000,
      finalAmount: 30000,
      platformFeeAmount: 2550,
      technicianPayoutAmount: 27450,
      conditionReport: {
        timestamp: oneMonthAgo,
        frontCondition: 'PERFECT',
        backCondition: 'MINOR_SCRATCHES',
        frameCondition: 'PRISTINE',
        screenPowersOn: true,
        touchResponsive: true,
        cameraWorking: true,
        existingDamageNotes: 'Battery degradation verified with digital multimeter.',
        accessoriesReceived: [],
        photos: [],
        technicianNotes: 'No water damage markers tripped.',
        confirmedByCustomer: true,
      },
      partsUsed: [
        {
          id: 'part_rec_comp_1',
          partName: 'Samsung S22 Ultra Original Battery (5000mAh)',
          deviceModel: 'Galaxy S22 Ultra',
          quality: 'ORIGINAL_OEM',
          priceNaira: 22000,
          warrantyDays: 90,
          installationTimestamp: pastDate,
        },
      ],
      warranty: {
        id: 'war_s22_batt_01',
        repairJobId: 'job_demo_completed',
        deviceBrand: 'Samsung',
        deviceModel: 'Galaxy S22 Ultra',
        coveredRepair: 'Battery Replacement (5000mAh OEM)',
        technicianId: 'usr_tech_1',
        technicianName: 'Emeka Okafor (Emeka Phone Labs)',
        periodDays: 90,
        startDate: pastDate,
        endDate: new Date(Date.now() + 85 * 24 * 60 * 60 * 1000).toISOString(),
        terms: 'Covers battery failure, abnormal discharge (>20% in 1 hr idle), or swelling. Excludes water damage or physical puncture.',
        status: 'ACTIVE',
      },
      createdAt: oneMonthAgo,
      bookedAt: oneMonthAgo,
      receivedAt: oneMonthAgo,
      repairStartedAt: oneMonthAgo,
      readyForPickupAt: pastDate,
      completedAt: pastDate,
      statusHistory: [
        { status: 'REQUESTED', timestamp: oneMonthAgo, actorRole: 'customer' },
        { status: 'QUOTE_ACCEPTED', timestamp: oneMonthAgo, actorRole: 'customer' },
        { status: 'PAYMENT_CONFIRMED', timestamp: oneMonthAgo, actorRole: 'customer' },
        { status: 'DEVICE_RECEIVED', timestamp: oneMonthAgo, actorRole: 'technician' },
        { status: 'REPAIR_IN_PROGRESS', timestamp: oneMonthAgo, actorRole: 'technician' },
        { status: 'READY_FOR_PICKUP', timestamp: pastDate, actorRole: 'technician' },
        { status: 'PICKED_UP', timestamp: pastDate, actorRole: 'customer' },
        { status: 'COMPLETED', timestamp: pastDate, actorRole: 'customer', note: 'Customer tested battery charging speed and approved release' },
      ],
    },
  ];

  // Payments
  const payments: PaymentTransaction[] = [
    {
      id: 'pay_demo_pending_01',
      repairId: 'job_demo_booked',
      customerId: 'usr_customer_1',
      technicianId: 'usr_tech_1',
      amountNaira: 55000,
      platformFeeNaira: 4675,
      technicianPayoutNaira: 50325,
      currency: 'NGN',
      provider: 'PAYSTACK_SANDBOX',
      status: 'INITIATED',
      transactionRef: 'FIX-PAY-9918231-LAGOS',
      idempotencyKey: 'idemp_pay_pending_001',
      paymentMethod: 'CARD',
    },
    {
      id: 'pay_demo_active_01',
      repairId: 'job_demo_active',
      customerId: 'usr_customer_1',
      technicianId: 'usr_tech_1',
      amountNaira: 60000,
      platformFeeNaira: 5100,
      technicianPayoutNaira: 54900,
      currency: 'NGN',
      provider: 'PAYSTACK_SANDBOX',
      status: 'ESCROW_HELD',
      transactionRef: 'FIX-PAY-8849102-LAGOS',
      idempotencyKey: 'idemp_pay_active_001',
      paymentMethod: 'CARD',
      paidAt: pastDate,
    },
    {
      id: 'pay_demo_comp_01',
      repairId: 'job_demo_completed',
      customerId: 'usr_customer_1',
      technicianId: 'usr_tech_1',
      amountNaira: 30000,
      platformFeeNaira: 2550,
      technicianPayoutNaira: 27450,
      currency: 'NGN',
      provider: 'PAYSTACK_SANDBOX',
      status: 'RELEASED_TO_TECHNICIAN',
      transactionRef: 'FIX-PAY-1120934-LAGOS',
      idempotencyKey: 'idemp_pay_comp_001',
      paymentMethod: 'BANK_TRANSFER',
      paidAt: oneMonthAgo,
      releasedAt: pastDate,
    },
  ];

  // Warranties
  const warranties: WarrantyRecord[] = [
    {
      id: 'war_s22_batt_01',
      repairJobId: 'job_demo_completed',
      deviceBrand: 'Samsung',
      deviceModel: 'Galaxy S22 Ultra',
      coveredRepair: 'Battery Replacement (5000mAh OEM)',
      coveredRepairs: ['Battery Replacement (5000mAh OEM)'],
      technicianId: 'usr_tech_1',
      technicianName: 'Emeka Okafor (Emeka Phone Labs)',
      periodDays: 90,
      startDate: pastDate,
      endDate: new Date(Date.now() + 85 * 24 * 60 * 60 * 1000).toISOString(),
      terms: 'Covers battery failure, abnormal discharge, or swelling. Excludes water damage or physical puncture.',
      status: 'ACTIVE',
    },
  ];

  // Reviews
  const reviews: Review[] = [
    {
      id: 'rev_01',
      repairId: 'job_demo_completed',
      customerId: 'usr_customer_1',
      customerName: 'Tunde Adebayo',
      technicianId: 'usr_tech_1',
      rating: 5,
      comment: 'Emeka did a fantastic job on my S22 Ultra battery. Dropped it off in Computer Village, tested it in 45 mins, and now the battery lasts over a full day. Super transparent!',
      verifiedPurchase: true,
      repairSummary: 'Samsung Galaxy S22 Ultra Battery Replacement',
      createdAt: pastDate,
    },
    {
      id: 'rev_02',
      repairId: 'job_historical_02',
      customerId: 'usr_customer_2',
      customerName: 'Ngozi Eze',
      technicianId: 'usr_tech_1',
      rating: 5,
      comment: 'Quick screen replacement for my iPhone 12. FaceID still works and TrueTone is intact. Very professional shop.',
      verifiedPurchase: true,
      repairSummary: 'iPhone 12 Screen Replacement',
      createdAt: oneMonthAgo,
    },
  ];

  // Audit Logs
  const auditLogs: AuditLog[] = [
    {
      id: 'audit_01',
      actorId: 'usr_customer_1',
      actorRole: 'customer',
      action: 'PAYMENT_ESCROW_AUTHORIZED',
      resourceType: 'PAYMENT',
      resourceId: 'pay_demo_active_01',
      details: { amountNaira: 60000, repairId: 'job_demo_active', provider: 'PAYSTACK_SANDBOX' },
      timestamp: pastDate,
    },
    {
      id: 'audit_02',
      actorId: 'usr_tech_1',
      actorRole: 'technician',
      action: 'DEVICE_CONDITION_LOGGED',
      resourceType: 'REPAIR_JOB',
      resourceId: 'job_demo_active',
      details: { frontCondition: 'CRACKED', screenPowersOn: true },
      timestamp: pastDate,
    },
  ];

  // Notifications
  const notifications: NotificationItem[] = [
    {
      id: 'notif_01',
      userId: 'usr_customer_1',
      title: 'Repair In Progress',
      message: 'Emeka Phone Labs has started installing parts for your iPhone 13.',
      type: 'STATUS_CHANGE',
      repairId: 'job_demo_active',
      read: false,
      createdAt: now,
    },
    {
      id: 'notif_02',
      userId: 'usr_tech_1',
      title: 'Payment Held in Escrow',
      message: '₦60,000 for iPhone 13 repair (Tunde Adebayo) is safely secured in Fix Hub Escrow.',
      type: 'PAYMENT',
      repairId: 'job_demo_active',
      read: true,
      createdAt: pastDate,
    },
  ];

  // Messages
  const messages: MessageItem[] = [
    {
      id: 'msg_01',
      repairId: 'job_demo_active',
      senderId: 'usr_tech_1',
      senderRole: 'technician',
      senderName: 'Emeka Okafor',
      text: 'Good afternoon Mr. Tunde, we just finished opening the device. The frame is in great shape, so the screen replacement will sit completely flush.',
      createdAt: pastDate,
    },
    {
      id: 'msg_02',
      repairId: 'job_demo_active',
      senderId: 'usr_customer_1',
      senderRole: 'customer',
      senderName: 'Tunde Adebayo',
      text: 'Awesome, thanks Emeka! Please ensure TrueTone calibration is copied over.',
      createdAt: pastDate,
    },
  ];

  return {
    version: 1,
    users,
    customerProfiles,
    technicianProfiles,
    deviceBrands,
    deviceFamilies,
    deviceModels,
    customerDevices,
    repairIssues,
    repairIssueCatalog: [...standardRepairIssues],
    drafts: [],
    repairRequests,
    repairQuotes,
    repairJobs,
    technicianParts,
    payments,
    warranties,
    reviews,
    auditLogs,
    notifications,
    messages,
    riskEvents: [],
  };
}

class Database {
  private data: DatabaseSchema;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    ensureDbDir();
    this.data = this.loadData();
  }

  private loadData(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        const fileContent = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(fileContent);
        if (parsed && parsed.version) {
          if (!parsed.deviceFamilies || parsed.deviceFamilies.length === 0) {
            parsed.deviceFamilies = [...seedFamilies];
          }
          if (!parsed.customerDevices) {
            parsed.customerDevices = [];
          }
          if (!parsed.deviceBrands || parsed.deviceBrands.length < seedBrands.length) {
            parsed.deviceBrands = [...seedBrands];
          }
          if (!parsed.deviceModels || parsed.deviceModels.length < seedModels.length) {
            parsed.deviceModels = [...seedModels];
          }
          if (!parsed.repairIssueCatalog || parsed.repairIssueCatalog.length < standardRepairIssues.length) {
            parsed.repairIssueCatalog = [...standardRepairIssues];
          }
          if (!parsed.drafts) {
            parsed.drafts = [];
          }
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Could not read existing database file, initializing fresh seed data:', err);
    }
    const seed = getInitialSeedData();
    this.saveDataDirect(seed);
    return seed;
  }

  private saveDataDirect(data: DatabaseSchema) {
    try {
      ensureDbDir();
      const tmpPath = `${DB_FILE_PATH}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpPath, DB_FILE_PATH);
    } catch (err) {
      console.error('Error persisting database to disk:', err);
    }
  }

  public save() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveDataDirect(this.data);
    }, 50);
  }

  public resetToSeed() {
    this.data = getInitialSeedData();
    this.saveDataDirect(this.data);
    return this.data;
  }

  // Schema Table Getters
  public get users() { return this.data.users; }
  public get customerProfiles() { return this.data.customerProfiles; }
  public get technicianProfiles() { return this.data.technicianProfiles; }
  public get deviceBrands() { return this.data.deviceBrands; }
  public get deviceFamilies() { return this.data.deviceFamilies; }
  public get deviceModels() { return this.data.deviceModels; }
  public get customerDevices() { return this.data.customerDevices; }
  public get repairIssues() { return this.data.repairIssues; }
  public get repairIssueCatalog() { return this.data.repairIssueCatalog; }
  public get drafts() { return this.data.drafts; }
  public get repairRequests() { return this.data.repairRequests; }
  public get repairQuotes() { return this.data.repairQuotes; }
  public get repairJobs() { return this.data.repairJobs; }
  public get technicianParts() { return this.data.technicianParts; }
  public get payments() { return this.data.payments; }
  public get warranties() { return this.data.warranties; }
  public get reviews() { return this.data.reviews; }
  public get auditLogs() { return this.data.auditLogs; }
  public get notifications() { return this.data.notifications; }
  public get messages() { return this.data.messages; }
  public get riskEvents() { return this.data.riskEvents; }
}

export const db = new Database();
