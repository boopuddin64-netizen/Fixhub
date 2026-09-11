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
  TechnicianInventoryItem,
  PaymentTransaction,
  Review,
  AuditLog,
  NotificationItem,
  MessageItem,
  WarrantyRecord,
  RepairIssue,
  RepairRequestDraft,
  RepairRequestAttachment,
  TechnicianEarnings,
  PayoutRecord,
  RefundRecord,
  WebhookEventRecord,
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
  technicianEarnings: TechnicianEarnings[];
  payouts: PayoutRecord[];
  refunds: RefundRecord[];
  webhookEvents: WebhookEventRecord[];
  warranties: WarrantyRecord[];
  reviews: Review[];
  auditLogs: AuditLog[];
  notifications: NotificationItem[];
  messages: MessageItem[];
  uploadedAttachments: Array<{
    id: string;
    url: string;
    ownerId: string;
    mimeType: string;
    size: number;
    createdAt: string;
  }>;
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

const isTestEnv =
  process.env.NODE_ENV === 'test' ||
  Boolean(process.env.BUN_TEST) ||
  Boolean(process.env.VITEST) ||
  process.argv.some((arg) => arg.includes('test'));

const PRIMARY_DB_FILE_PATH = path.resolve(
  process.cwd(),
  process.env.DATA_STORAGE_PATH || './data/fixhub.db.json'
);

const DB_FILE_PATH = isTestEnv
  ? path.resolve('/tmp', 'fixhub.test.db.json')
  : PRIMARY_DB_FILE_PATH;

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
    {
      id: 'usr_tech_5',
      email: 'tonye@test.fixhub.local',
      phone: '+234 803 222 3344',
      name: 'Tonye Briggs',
      role: 'technician',
      avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
      createdAt: oneMonthAgo,
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr_tech_6',
      email: 'usman@test.fixhub.local',
      phone: '+234 802 888 9900',
      name: 'Usman Garba',
      role: 'technician',
      avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
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
      rating: 0,
      reviewCount: 0,
      completedJobs: 0,
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
      rating: 0,
      reviewCount: 0,
      completedJobs: 0,
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
      rating: 0,
      reviewCount: 0,
      completedJobs: 0,
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
      rating: 0,
      reviewCount: 0,
      completedJobs: 0,
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
    {
      userId: 'usr_tech_5',
      businessName: 'Garrison Phone Hospital (Port Harcourt)',
      bio: 'Leading mobile phone repair hub in Port Harcourt. Specialized micro-soldering and screen replacements.',
      shopLocation: {
        lat: 4.8156,
        lng: 7.0128,
        address: 'Garrison Junction, Aba Road',
        landmark: 'Garrison Electronics Market',
        area: 'Garrison / Aba Road',
        city: 'Port Harcourt',
        state: 'Rivers State',
      },
      serviceRadiusKm: 25,
      businessHours: 'Mon - Sat: 8:00 AM - 6:00 PM',
      yearsExperience: 7,
      phone: '+234 803 222 3344',
      avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
      shopPhotos: [],
      supportedBrands: ['Apple', 'Samsung', 'Tecno', 'Infinix', 'Xiaomi'],
      supportedCategories: ['screen_damaged', 'screen_not_displaying', 'battery_problem', 'charging_problem', 'water_damage', 'no_power'],
      availability: 'AVAILABLE',
      rating: 0,
      reviewCount: 0,
      completedJobs: 0,
      quoteAccuracyScore: 97.0,
      cancellationRate: 1.0,
      averageResponseMinutes: 10,
      trustScore: 92,
      trustLevel: 'HIGHLY_TRUSTED',
      verificationStatus: {
        basic: true,
        locationConfirmed: true,
        identityVerified: true,
        businessVerified: true,
        payoutVerified: true,
      },
    },
    {
      userId: 'usr_tech_6',
      businessName: 'Emab Plaza Tech Clinic (Wuse 2 Abuja)',
      bio: 'Certified repair centre at Emab Plaza Wuse 2. Fast service for flagship iPhones and Galaxy devices.',
      shopLocation: {
        lat: 9.0765,
        lng: 7.4721,
        address: 'Suite B14, Emab Plaza, Aminu Kano Crescent, Wuse 2',
        landmark: 'Emab Plaza Phone Hub',
        area: 'Wuse 2',
        city: 'Abuja Municipal',
        state: 'Abuja FCT',
      },
      serviceRadiusKm: 25,
      businessHours: 'Mon - Sat: 8:30 AM - 6:30 PM',
      yearsExperience: 6,
      phone: '+234 802 888 9900',
      avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
      shopPhotos: [],
      supportedBrands: ['Apple', 'Samsung', 'Google', 'OnePlus', 'Xiaomi'],
      supportedCategories: ['screen_damaged', 'screen_not_displaying', 'battery_problem', 'charging_problem', 'camera_problem', 'no_power'],
      availability: 'AVAILABLE',
      rating: 4.9,
      reviewCount: 82,
      completedJobs: 140,
      quoteAccuracyScore: 98.0,
      cancellationRate: 0.8,
      averageResponseMinutes: 8,
      trustScore: 95,
      trustLevel: 'HIGHLY_TRUSTED',
      verificationStatus: {
        basic: true,
        locationConfirmed: true,
        identityVerified: true,
        businessVerified: true,
        payoutVerified: true,
      },
    },
  ];

  // Technician Parts Catalog & Inventory (Test Inventory for designated test technician usr_tech_1 only)
  const technicianParts: TechnicianInventoryItem[] = [
    // --- iPhone Test Inventory ---
    {
      id: 'part_ip11_scr',
      inventoryItemId: 'part_ip11_scr',
      technicianId: 'usr_tech_1',
      partName: 'iPhone 11 Liquid Retina HD Display (Test Inventory)',
      name: 'iPhone 11 Liquid Retina HD Display (Test Inventory)',
      category: 'Display / Screen',
      brand: 'Apple',
      deviceBrand: 'Apple',
      compatibleModels: ['iPhone 11'],
      deviceModel: 'iPhone 11',
      quality: 'ORIGINAL_OEM',
      sku: 'SKU-TEST-IP11-SCR',
      unitPriceNaira: 38000,
      priceNaira: 38000,
      currency: 'NGN',
      quantityOnHand: 5,
      inStockCount: 5,
      stockQuantity: 5,
      quantityReserved: 0,
      quantityAvailable: 5,
      warrantyDays: 90,
      status: 'IN_STOCK',
      priceVersion: 1,
      priceHistory: [{ priceNaira: 38000, version: 1, changedAt: oneMonthAgo, reason: 'Initial test inventory' }],
      partsUsedCount: 4,
      supplier: 'Fixhub Genuine Parts Hub',
      createdAt: oneMonthAgo,
      updatedAt: pastDate,
    },
    {
      id: 'part_ip12_scr',
      inventoryItemId: 'part_ip12_scr',
      technicianId: 'usr_tech_1',
      partName: 'iPhone 12 Super Retina XDR OLED Display (Test Inventory)',
      name: 'iPhone 12 Super Retina XDR OLED Display (Test Inventory)',
      category: 'Display / Screen',
      brand: 'Apple',
      deviceBrand: 'Apple',
      compatibleModels: ['iPhone 12', 'iPhone 12 Pro'],
      deviceModel: 'iPhone 12',
      quality: 'ORIGINAL_OEM',
      sku: 'SKU-TEST-IP12-SCR',
      unitPriceNaira: 62000,
      priceNaira: 62000,
      currency: 'NGN',
      quantityOnHand: 4,
      inStockCount: 4,
      stockQuantity: 4,
      quantityReserved: 0,
      quantityAvailable: 4,
      warrantyDays: 90,
      status: 'IN_STOCK',
      priceVersion: 1,
      priceHistory: [{ priceNaira: 62000, version: 1, changedAt: oneMonthAgo, reason: 'Initial test inventory' }],
      partsUsedCount: 6,
      supplier: 'Fixhub Genuine Parts Hub',
      createdAt: oneMonthAgo,
      updatedAt: pastDate,
    },
    {
      id: 'part_ip13_scr',
      inventoryItemId: 'part_ip13_scr',
      technicianId: 'usr_tech_1',
      partName: 'iPhone 13 OLED Display Panel (Test Inventory)',
      name: 'iPhone 13 OLED Display Panel (Test Inventory)',
      category: 'Display / Screen',
      brand: 'Apple',
      deviceBrand: 'Apple',
      compatibleModels: ['iPhone 13'],
      deviceModel: 'iPhone 13',
      quality: 'ORIGINAL_OEM',
      sku: 'SKU-TEST-IP13-SCR',
      unitPriceNaira: 75000,
      priceNaira: 75000,
      currency: 'NGN',
      quantityOnHand: 6,
      inStockCount: 6,
      stockQuantity: 6,
      quantityReserved: 0,
      quantityAvailable: 6,
      warrantyDays: 90,
      status: 'IN_STOCK',
      priceVersion: 1,
      priceHistory: [{ priceNaira: 75000, version: 1, changedAt: oneMonthAgo, reason: 'Initial test inventory' }],
      partsUsedCount: 12,
      supplier: 'Fixhub Genuine Parts Hub',
      createdAt: oneMonthAgo,
      updatedAt: pastDate,
    },
    {
      id: 'part_ip11_bat',
      inventoryItemId: 'part_ip11_bat',
      technicianId: 'usr_tech_1',
      partName: 'iPhone 11 Replacement Battery 3110mAh (Test Inventory)',
      name: 'iPhone 11 Replacement Battery 3110mAh (Test Inventory)',
      category: 'Battery / Power',
      brand: 'Apple',
      deviceBrand: 'Apple',
      compatibleModels: ['iPhone 11'],
      deviceModel: 'iPhone 11',
      quality: 'ORIGINAL_OEM',
      sku: 'SKU-TEST-IP11-BAT',
      unitPriceNaira: 16000,
      priceNaira: 16000,
      currency: 'NGN',
      quantityOnHand: 8,
      inStockCount: 8,
      stockQuantity: 8,
      quantityReserved: 0,
      quantityAvailable: 8,
      warrantyDays: 90,
      status: 'IN_STOCK',
      priceVersion: 1,
      priceHistory: [{ priceNaira: 16000, version: 1, changedAt: oneMonthAgo, reason: 'Initial test inventory' }],
      partsUsedCount: 5,
      supplier: 'Fixhub Genuine Parts Hub',
      createdAt: oneMonthAgo,
      updatedAt: pastDate,
    },
    {
      id: 'part_ip12_bat',
      inventoryItemId: 'part_ip12_bat',
      technicianId: 'usr_tech_1',
      partName: 'iPhone 12 Replacement Battery 2815mAh (Test Inventory)',
      name: 'iPhone 12 Replacement Battery 2815mAh (Test Inventory)',
      category: 'Battery / Power',
      brand: 'Apple',
      deviceBrand: 'Apple',
      compatibleModels: ['iPhone 12', 'iPhone 12 Pro'],
      deviceModel: 'iPhone 12',
      quality: 'ORIGINAL_OEM',
      sku: 'SKU-TEST-IP12-BAT',
      unitPriceNaira: 19000,
      priceNaira: 19000,
      currency: 'NGN',
      quantityOnHand: 7,
      inStockCount: 7,
      stockQuantity: 7,
      quantityReserved: 0,
      quantityAvailable: 7,
      warrantyDays: 90,
      status: 'IN_STOCK',
      priceVersion: 1,
      priceHistory: [{ priceNaira: 19000, version: 1, changedAt: oneMonthAgo, reason: 'Initial test inventory' }],
      partsUsedCount: 8,
      supplier: 'Fixhub Genuine Parts Hub',
      createdAt: oneMonthAgo,
      updatedAt: pastDate,
    },
    {
      id: 'part_ip13_bat',
      inventoryItemId: 'part_ip13_bat',
      technicianId: 'usr_tech_1',
      partName: 'iPhone 13 Replacement Battery 3227mAh (Test Inventory)',
      name: 'iPhone 13 Replacement Battery 3227mAh (Test Inventory)',
      category: 'Battery / Power',
      brand: 'Apple',
      deviceBrand: 'Apple',
      compatibleModels: ['iPhone 13'],
      deviceModel: 'iPhone 13',
      quality: 'ORIGINAL_OEM',
      sku: 'SKU-TEST-IP13-BAT',
      unitPriceNaira: 24000,
      priceNaira: 24000,
      currency: 'NGN',
      quantityOnHand: 6,
      inStockCount: 6,
      stockQuantity: 6,
      quantityReserved: 0,
      quantityAvailable: 6,
      warrantyDays: 90,
      status: 'IN_STOCK',
      priceVersion: 1,
      priceHistory: [{ priceNaira: 24000, version: 1, changedAt: oneMonthAgo, reason: 'Initial test inventory' }],
      partsUsedCount: 9,
      supplier: 'Fixhub Genuine Parts Hub',
      createdAt: oneMonthAgo,
      updatedAt: pastDate,
    },
    {
      id: 'part_ip_chg',
      inventoryItemId: 'part_ip_chg',
      technicianId: 'usr_tech_1',
      partName: 'iPhone Lightning Charging Flex Port Assembly (Test Inventory)',
      name: 'iPhone Lightning Charging Flex Port Assembly (Test Inventory)',
      category: 'Charging / Ports',
      brand: 'Apple',
      deviceBrand: 'Apple',
      compatibleModels: ['iPhone 11', 'iPhone 12', 'iPhone 13'],
      deviceModel: 'iPhone 13',
      quality: 'ORIGINAL_OEM',
      sku: 'SKU-TEST-IP-CHG',
      unitPriceNaira: 12000,
      priceNaira: 12000,
      currency: 'NGN',
      quantityOnHand: 10,
      inStockCount: 10,
      stockQuantity: 10,
      quantityReserved: 0,
      quantityAvailable: 10,
      warrantyDays: 90,
      status: 'IN_STOCK',
      priceVersion: 1,
      priceHistory: [{ priceNaira: 12000, version: 1, changedAt: oneMonthAgo, reason: 'Initial test inventory' }],
      partsUsedCount: 11,
      supplier: 'Fixhub Genuine Parts Hub',
      createdAt: oneMonthAgo,
      updatedAt: pastDate,
    },
    // --- Samsung Test Inventory ---
    {
      id: 'part_sam_a12_scr',
      inventoryItemId: 'part_sam_a12_scr',
      technicianId: 'usr_tech_1',
      partName: 'Samsung Galaxy A12 PLS TFT Display Assembly (Test Inventory)',
      name: 'Samsung Galaxy A12 PLS TFT Display Assembly (Test Inventory)',
      category: 'Display / Screen',
      brand: 'Samsung',
      deviceBrand: 'Samsung',
      compatibleModels: ['Galaxy A12', 'SM-A125F'],
      deviceModel: 'Galaxy A12',
      quality: 'ORIGINAL_OEM',
      sku: 'SKU-TEST-SAM-A12-SCR',
      unitPriceNaira: 22000,
      priceNaira: 22000,
      currency: 'NGN',
      quantityOnHand: 6,
      inStockCount: 6,
      stockQuantity: 6,
      quantityReserved: 0,
      quantityAvailable: 6,
      warrantyDays: 90,
      status: 'IN_STOCK',
      priceVersion: 1,
      priceHistory: [{ priceNaira: 22000, version: 1, changedAt: oneMonthAgo, reason: 'Initial test inventory' }],
      partsUsedCount: 7,
      supplier: 'Fixhub Genuine Parts Hub',
      createdAt: oneMonthAgo,
      updatedAt: pastDate,
    },
    {
      id: 'part_sam_a13_scr',
      inventoryItemId: 'part_sam_a13_scr',
      technicianId: 'usr_tech_1',
      partName: 'Samsung Galaxy A13 PLS LCD Display Panel (Test Inventory)',
      name: 'Samsung Galaxy A13 PLS LCD Display Panel (Test Inventory)',
      category: 'Display / Screen',
      brand: 'Samsung',
      deviceBrand: 'Samsung',
      compatibleModels: ['Galaxy A13', 'SM-A135F'],
      deviceModel: 'Galaxy A13',
      quality: 'ORIGINAL_OEM',
      sku: 'SKU-TEST-SAM-A13-SCR',
      unitPriceNaira: 26000,
      priceNaira: 26000,
      currency: 'NGN',
      quantityOnHand: 5,
      inStockCount: 5,
      stockQuantity: 5,
      quantityReserved: 0,
      quantityAvailable: 5,
      warrantyDays: 90,
      status: 'IN_STOCK',
      priceVersion: 1,
      priceHistory: [{ priceNaira: 26000, version: 1, changedAt: oneMonthAgo, reason: 'Initial test inventory' }],
      partsUsedCount: 5,
      supplier: 'Fixhub Genuine Parts Hub',
      createdAt: oneMonthAgo,
      updatedAt: pastDate,
    },
    {
      id: 'part_sam_a14_scr',
      inventoryItemId: 'part_sam_a14_scr',
      technicianId: 'usr_tech_1',
      partName: 'Samsung Galaxy A14 PLS LCD FHD+ Screen (Test Inventory)',
      name: 'Samsung Galaxy A14 PLS LCD FHD+ Screen (Test Inventory)',
      category: 'Display / Screen',
      brand: 'Samsung',
      deviceBrand: 'Samsung',
      compatibleModels: ['Galaxy A14', 'Galaxy A14 5G'],
      deviceModel: 'Galaxy A14',
      quality: 'ORIGINAL_OEM',
      sku: 'SKU-TEST-SAM-A14-SCR',
      unitPriceNaira: 29000,
      priceNaira: 29000,
      currency: 'NGN',
      quantityOnHand: 4,
      inStockCount: 4,
      stockQuantity: 4,
      quantityReserved: 0,
      quantityAvailable: 4,
      warrantyDays: 90,
      status: 'IN_STOCK',
      priceVersion: 1,
      priceHistory: [{ priceNaira: 29000, version: 1, changedAt: oneMonthAgo, reason: 'Initial test inventory' }],
      partsUsedCount: 3,
      supplier: 'Fixhub Genuine Parts Hub',
      createdAt: oneMonthAgo,
      updatedAt: pastDate,
    },
    {
      id: 'part_sam_a12_bat',
      inventoryItemId: 'part_sam_a12_bat',
      technicianId: 'usr_tech_1',
      partName: 'Samsung Galaxy A12 Battery 5000mAh (Test Inventory)',
      name: 'Samsung Galaxy A12 Battery 5000mAh (Test Inventory)',
      category: 'Battery / Power',
      brand: 'Samsung',
      deviceBrand: 'Samsung',
      compatibleModels: ['Galaxy A12', 'Galaxy A02s'],
      deviceModel: 'Galaxy A12',
      quality: 'ORIGINAL_OEM',
      sku: 'SKU-TEST-SAM-A12-BAT',
      unitPriceNaira: 14000,
      priceNaira: 14000,
      currency: 'NGN',
      quantityOnHand: 8,
      inStockCount: 8,
      stockQuantity: 8,
      quantityReserved: 0,
      quantityAvailable: 8,
      warrantyDays: 90,
      status: 'IN_STOCK',
      priceVersion: 1,
      priceHistory: [{ priceNaira: 14000, version: 1, changedAt: oneMonthAgo, reason: 'Initial test inventory' }],
      partsUsedCount: 4,
      supplier: 'Fixhub Genuine Parts Hub',
      createdAt: oneMonthAgo,
      updatedAt: pastDate,
    },
    {
      id: 'part_sam_a13_bat',
      inventoryItemId: 'part_sam_a13_bat',
      technicianId: 'usr_tech_1',
      partName: 'Samsung Galaxy A13 Battery 5000mAh (Test Inventory)',
      name: 'Samsung Galaxy A13 Battery 5000mAh (Test Inventory)',
      category: 'Battery / Power',
      brand: 'Samsung',
      deviceBrand: 'Samsung',
      compatibleModels: ['Galaxy A13', 'Galaxy A23'],
      deviceModel: 'Galaxy A13',
      quality: 'ORIGINAL_OEM',
      sku: 'SKU-TEST-SAM-A13-BAT',
      unitPriceNaira: 15000,
      priceNaira: 15000,
      currency: 'NGN',
      quantityOnHand: 7,
      inStockCount: 7,
      stockQuantity: 7,
      quantityReserved: 0,
      quantityAvailable: 7,
      warrantyDays: 90,
      status: 'IN_STOCK',
      priceVersion: 1,
      priceHistory: [{ priceNaira: 15000, version: 1, changedAt: oneMonthAgo, reason: 'Initial test inventory' }],
      partsUsedCount: 6,
      supplier: 'Fixhub Genuine Parts Hub',
      createdAt: oneMonthAgo,
      updatedAt: pastDate,
    },
    {
      id: 'part_sam_chg',
      inventoryItemId: 'part_sam_chg',
      technicianId: 'usr_tech_1',
      partName: 'Samsung Galaxy USB-C Charging Port Board (Test Inventory)',
      name: 'Samsung Galaxy USB-C Charging Port Board (Test Inventory)',
      category: 'Charging / Ports',
      brand: 'Samsung',
      deviceBrand: 'Samsung',
      compatibleModels: ['Galaxy A12', 'Galaxy A13', 'Galaxy A14'],
      deviceModel: 'Galaxy A13',
      quality: 'ORIGINAL_OEM',
      sku: 'SKU-TEST-SAM-CHG',
      unitPriceNaira: 8500,
      priceNaira: 8500,
      currency: 'NGN',
      quantityOnHand: 12,
      inStockCount: 12,
      stockQuantity: 12,
      quantityReserved: 0,
      quantityAvailable: 12,
      warrantyDays: 90,
      status: 'IN_STOCK',
      priceVersion: 1,
      priceHistory: [{ priceNaira: 8500, version: 1, changedAt: oneMonthAgo, reason: 'Initial test inventory' }],
      partsUsedCount: 10,
      supplier: 'Fixhub Genuine Parts Hub',
      createdAt: oneMonthAgo,
      updatedAt: pastDate,
    },
  ];

  // Seed Repair Requests
  const repairRequests: RepairRequest[] = [];

  // Seed Quotes
  const repairQuotes: RepairQuote[] = [];

  // Seed Repair Jobs
  const repairJobs: RepairJob[] = [];

  // Payments
  const payments: PaymentTransaction[] = [];

  // Warranties
  const warranties: WarrantyRecord[] = [];

  // Reviews
  const reviews: Review[] = [];

  // Audit Logs
  const auditLogs: AuditLog[] = [];

  // Notifications
  const notifications: NotificationItem[] = [];

  // Messages
  const messages: MessageItem[] = [];

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
    technicianEarnings: [],
    payouts: [],
    refunds: [],
    webhookEvents: [],
    warranties,
    reviews,
    auditLogs,
    notifications,
    messages,
    uploadedAttachments: [],
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
      const pathToRead = fs.existsSync(DB_FILE_PATH)
        ? DB_FILE_PATH
        : fs.existsSync(PRIMARY_DB_FILE_PATH)
        ? PRIMARY_DB_FILE_PATH
        : null;

      if (pathToRead && fs.existsSync(pathToRead)) {
        const fileContent = fs.readFileSync(pathToRead, 'utf-8');
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
          if (!parsed.technicianEarnings) {
            parsed.technicianEarnings = [];
          }
          if (!parsed.payouts) {
            parsed.payouts = [];
          }
          if (!parsed.refunds) {
            parsed.refunds = [];
          }
          if (!parsed.webhookEvents) {
            parsed.webhookEvents = [];
          }
          if (!parsed.uploadedAttachments) {
            parsed.uploadedAttachments = [];
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
  public get technicianEarnings() { return this.data.technicianEarnings; }
  public get payouts() { return this.data.payouts; }
  public get refunds() { return this.data.refunds; }
  public get webhookEvents() { return this.data.webhookEvents; }
  public get warranties() { return this.data.warranties; }
  public get reviews() { return this.data.reviews; }
  public get auditLogs() { return this.data.auditLogs; }
  public get notifications() { return this.data.notifications; }
  public get messages() { return this.data.messages; }
  public get uploadedAttachments() {
    if (!this.data.uploadedAttachments) this.data.uploadedAttachments = [];
    return this.data.uploadedAttachments;
  }
  public get riskEvents() { return this.data.riskEvents; }
}

export const db = new Database();
