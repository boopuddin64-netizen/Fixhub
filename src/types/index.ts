export type UserRole = 'customer' | 'technician' | 'admin';

export type AvailabilityStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';

export type PartsQuality =
  | 'ORIGINAL_OEM'
  | 'PREMIUM_AFTERMARKET'
  | 'STANDARD_AFTERMARKET'
  | 'REFURBISHED'
  | 'UNKNOWN';

export type RepairLifecycleStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'MATCHING'
  | 'TECHNICIANS_FOUND'
  | 'REQUESTED'
  | 'QUOTING'
  | 'QUOTE_RECEIVED'
  | 'QUOTE_ACCEPTED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_CONFIRMED'
  | 'BOOKED'
  | 'DEVICE_DROPPED_OFF'
  | 'DEVICE_RECEIVED'
  | 'DIAGNOSING'
  | 'IN_REPAIR'
  | 'REPAIR_IN_PROGRESS'
  | 'ADDITIONAL_DIAGNOSIS'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'COMPLETED'
  | 'REPAIR_COMPLETED'
  | 'DISPUTED'
  | 'CANCELLED'
  | 'REFUNDED';

export type TrustLevel =
  | 'NEW'
  | 'ESTABLISHED'
  | 'TRUSTED'
  | 'HIGHLY_TRUSTED'
  | 'UNDER_REVIEW';

export interface LocationCoordinates {
  lat: number;
  lng: number;
  address: string;
  landmark?: string;
  area?: string;
  city: string;
  state: string;
}

export interface VerificationStatus {
  basic: boolean;
  locationConfirmed: boolean;
  identityVerified: boolean;
  businessVerified: boolean;
  payoutVerified: boolean;
}

export interface User {
  id: string;
  email: string;
  phone: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
  isBorrowedDeviceSession?: boolean;
}

export interface CustomerProfile {
  userId: string;
  savedLocations: LocationCoordinates[];
  defaultLocation?: LocationCoordinates;
  totalRepairsCount: number;
  activeRepairsCount: number;
  emergencyContactPhone?: string;
}

export interface TechnicianProfile {
  userId: string;
  businessName: string;
  bio: string;
  shopLocation: LocationCoordinates;
  serviceRadiusKm: number;
  businessHours: string;
  yearsExperience: number;
  phone: string;
  avatarUrl: string;
  shopPhotos: string[];
  supportedBrands: string[];
  supportedCategories: string[];
  availability: AvailabilityStatus;
  
  // Performance & Trust Metrics
  rating: number;
  reviewCount: number;
  completedJobs: number;
  quoteAccuracyScore: number; // 0-100%
  cancellationRate: number; // 0-100%
  averageResponseMinutes: number;
  trustScore: number; // 0-100
  trustLevel: TrustLevel;
  verificationStatus: VerificationStatus;
  
  // Banking / Payout
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    verified: boolean;
  };
}

export type DeviceType = 'PHONE' | 'TABLET';

export interface DeviceBrand {
  id: string;
  name: string;
  slug?: string;
  deviceTypes?: DeviceType[];
  logoUrl?: string;
  popularModelsCount: number;
}

export interface DeviceFamily {
  id: string;
  brandId: string;
  name: string;
  deviceType: DeviceType;
}

export interface DeviceModel {
  id: string;
  brandId: string;
  brandName: string;
  familyId?: string;
  familyName?: string;
  name: string;
  releaseYear: number;
  deviceType?: DeviceType;
  isPopular?: boolean;
  isActive?: boolean;
  commonIssues: string[];
  imageUrl?: string;
}

export interface CustomerDevice {
  id: string;
  customerId: string;
  deviceModelId?: string;
  brandName: string;
  modelName: string;
  deviceType: DeviceType;
  nickname?: string;
  color?: string;
  storage?: string;
  isPrimary: boolean;
  catalogMatch: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RepairIssueOption {
  id: string;
  label: string;
  description: string;
  iconName: string;
  estimatedLaborMinutes: number;
  typicalCostRangeNaira: [number, number];
}

export type RepairIssueCategory =
  | 'Screen & Display'
  | 'Power & Battery'
  | 'Camera'
  | 'Audio'
  | 'Network & Connectivity'
  | 'Physical Damage'
  | 'Software'
  | 'Other';

export interface RepairIssue {
  id: string;
  name: string;
  category: RepairIssueCategory;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  iconName?: string;
  estimatedLaborMinutes?: number;
  typicalCostRangeNaira?: [number, number];
  canonicalIssueId?: string;
}

export interface RepairRequestAttachment {
  id: string;
  repairRequestId?: string;
  type: 'IMAGE' | 'AUDIO';
  url: string;
  mimeType?: string;
  size?: number;
  createdAt: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
}

export interface RepairRequestDraft {
  id: string;
  customerId: string;
  deviceBrand?: string;
  deviceModel?: string;
  deviceModelId?: string;
  deviceType?: DeviceType;
  catalogMatch?: boolean;
  issues?: string[];
  otherDescription?: string;
  description?: string;
  voiceNoteUrl?: string;
  voiceNoteDurationSeconds?: number;
  photos?: string[];
  attachments?: RepairRequestAttachment[];
  customerLocation?: LocationCoordinates;
  step?: number;
  updatedAt: string;
}

export interface RepairRequest {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerLocation: LocationCoordinates;
  deviceBrand: string;
  deviceModel: string;
  deviceModelId?: string;
  deviceType?: DeviceType;
  catalogMatch?: boolean;
  issues: string[];
  description: string;
  otherDescription?: string;
  photos: string[];
  attachments?: RepairRequestAttachment[];
  voiceNoteUrl?: string;
  voiceNoteDurationSeconds?: number;
  status: RepairLifecycleStatus;
  quotesCount: number;
  quotes?: RepairQuote[];
  selectedTechnicianId?: string;
  selectedQuoteId?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RepairQuote {
  id: string;
  requestId: string;
  technicianId: string;
  technicianName: string;
  businessName: string;
  technicianPhone: string;
  technicianAvatar?: string;
  technicianRating: number;
  technicianReviewsCount: number;
  distanceKm: number;
  partsCost: number;
  laborCost: number;
  otherCost: number;
  totalAmount: number;
  estimatedTimeHours: number;
  warrantyDays: number;
  partsQuality: PartsQuality;
  notes: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  createdAt: string;
}

export interface ConditionReport {
  timestamp: string;
  frontCondition: 'PERFECT' | 'MINOR_SCRATCHES' | 'CRACKED' | 'SHATTERED';
  backCondition: 'PERFECT' | 'MINOR_SCRATCHES' | 'CRACKED' | 'SHATTERED';
  frameCondition: 'PRISTINE' | 'SCUFFED' | 'BENT' | 'DENTED';
  screenPowersOn: boolean;
  touchResponsive: boolean;
  cameraWorking: boolean;
  existingDamageNotes: string;
  accessoriesReceived: string[];
  photos: string[];
  technicianNotes: string;
  confirmedByCustomer?: boolean;
}

export interface PartUsedRecord {
  id: string;
  partId?: string;
  partName: string;
  deviceModel: string;
  quality: PartsQuality;
  priceNaira: number;
  warrantyDays: number;
  supplier?: string;
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
  installationTimestamp: string;
}

export interface AdditionalDiagnosis {
  id: string;
  discoveredAt: string;
  title: string;
  description: string;
  photoEvidence: string[];
  additionalCostNaira: number;
  newTotalAmountNaira: number;
  isMinorAutoApproved: boolean;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  resolvedAt?: string;
}

export interface WarrantyRecord {
  id: string;
  repairJobId: string;
  deviceBrand: string;
  deviceModel: string;
  coveredRepair?: string;
  coveredRepairs?: string[];
  technicianId: string;
  technicianName: string;
  periodDays: number;
  startDate: string;
  endDate: string;
  terms: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CLAIMED';
}

export interface RepairJob {
  id: string;
  bookingRef?: string;
  requestId: string;
  quoteId: string;
  customerId: string;
  technicianId: string;
  deviceBrand: string;
  deviceModel: string;
  issues: string[];
  status: RepairLifecycleStatus;
  
  // Security Tokens for Handoffs
  dropOffCode: string; // 6-character code
  pickupCode: string;  // 6-character code
  handoffQrToken: string;
  
  // Total costs
  originalQuoteAmount: number;
  finalAmount: number;
  platformFeeAmount: number;
  technicianPayoutAmount: number;
  
  // Workflow records
  conditionReport?: ConditionReport;
  partsUsed: PartUsedRecord[];
  additionalDiagnosis?: AdditionalDiagnosis;
  warranty?: WarrantyRecord;
  
  // Timestamps
  createdAt: string;
  bookedAt?: string;
  receivedAt?: string;
  repairStartedAt?: string;
  readyForPickupAt?: string;
  completedAt?: string;
  
  statusHistory: Array<{
    status: RepairLifecycleStatus;
    timestamp: string;
    actorRole: UserRole;
    note?: string;
  }>;
}

export interface TechnicianPart {
  id: string;
  technicianId: string;
  name: string;
  partName?: string;
  deviceBrand: string;
  deviceModel: string;
  quality: PartsQuality;
  priceNaira: number;
  inStockCount: number;
  stockQuantity?: number;
  warrantyDays: number;
  photoUrl?: string;
}

export interface PaymentTransaction {
  id: string;
  repairId: string;
  customerId: string;
  technicianId: string;
  amountNaira: number;
  platformFeeNaira: number;
  technicianPayoutNaira: number;
  currency: 'NGN';
  provider: 'PAYSTACK_SANDBOX' | 'PAYSTACK_LIVE';
  status: 'INITIATED' | 'ESCROW_HELD' | 'RELEASED_TO_TECHNICIAN' | 'REFUNDED' | 'DISPUTED';
  transactionRef: string;
  idempotencyKey: string;
  paymentMethod: 'CARD' | 'BANK_TRANSFER' | 'USSD';
  paidAt?: string;
  releasedAt?: string;
  refundedAt?: string;
}

export interface Review {
  id: string;
  repairId: string;
  customerId: string;
  customerName: string;
  technicianId: string;
  rating: number; // 1 to 5
  comment: string;
  verifiedPurchase: true;
  repairSummary: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorRole: UserRole;
  action: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'QUOTE' | 'STATUS_CHANGE' | 'PAYMENT' | 'WARRANTY' | 'MESSAGE' | 'SECURITY';
  repairId?: string;
  read: boolean;
  createdAt: string;
}

export interface MessageItem {
  id: string;
  repairId: string;
  senderId: string;
  senderRole: UserRole;
  senderName: string;
  text: string;
  attachmentUrl?: string;
  createdAt: string;
}

export interface MatchScoreResult {
  technicianId: string;
  totalScore: number; // 0-100
  distanceKm: number;
  breakdown: {
    distanceScore: number;
    expertiseScore: number;
    reliabilityScore: number;
    ratingScore: number;
    responseScore: number;
    availabilityScore: number;
  };
  technician: TechnicianProfile;
}

export type TechnicianMatchResult = MatchScoreResult;
