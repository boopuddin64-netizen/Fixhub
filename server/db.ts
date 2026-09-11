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
import { pgDb, PostgresDatabase, TransactionClient } from './db/pgClient';
import { getInitialSeedData, SeedDataResult } from './db/seedData';

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

export class Database {
  private static instance: Database;
  public pg = pgDb;

  // In-memory synced state backed by relational database
  public users: (User & { passwordHash: string })[] = [];
  public customerProfiles: CustomerProfile[] = [];
  public technicianProfiles: TechnicianProfile[] = [];
  public deviceBrands: DeviceBrand[] = [];
  public deviceFamilies: DeviceFamily[] = [];
  public deviceModels: DeviceModel[] = [];
  public customerDevices: CustomerDevice[] = [];
  public repairIssues: RepairIssueOption[] = [];
  public repairIssueCatalog: RepairIssue[] = [];
  public drafts: RepairRequestDraft[] = [];
  public repairRequests: RepairRequest[] = [];
  public repairQuotes: RepairQuote[] = [];
  public repairJobs: RepairJob[] = [];
  public technicianParts: (TechnicianPart | TechnicianInventoryItem)[] = [];
  public payments: PaymentTransaction[] = [];
  public technicianEarnings: TechnicianEarnings[] = [];
  public payouts: PayoutRecord[] = [];
  public refunds: RefundRecord[] = [];
  public webhookEvents: WebhookEventRecord[] = [];
  public warranties: WarrantyRecord[] = [];
  public reviews: Review[] = [];
  public auditLogs: AuditLog[] = [];
  public notifications: NotificationItem[] = [];
  public messages: MessageItem[] = [];
  public uploadedAttachments: Array<{
    id: string;
    url: string;
    ownerId: string;
    mimeType: string;
    size: number;
    createdAt: string;
  }> = [];
  public riskEvents: Array<{
    id: string;
    actorId: string;
    eventType: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    metadata: Record<string, unknown>;
    reviewed: boolean;
    timestamp: string;
  }> = [];

  private constructor() {
    this.resetToSeed();
  }

  /**
   * Backward-compatibility accessor for tests or legacy code expecting db.data
   */
  public get data(): this {
    return this;
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  /**
   * Resets all entities to initial seed data.
   */
  public resetToSeed(): void {
    const seed = getInitialSeedData();
    this.users = seed.users;
    this.customerProfiles = seed.customerProfiles;
    this.technicianProfiles = seed.technicianProfiles;
    this.deviceBrands = seed.deviceBrands;
    this.deviceFamilies = seed.deviceFamilies;
    this.deviceModels = seed.deviceModels;
    this.customerDevices = seed.customerDevices;
    this.repairIssues = seed.repairIssues;
    this.repairIssueCatalog = seed.repairIssueCatalog;
    this.technicianParts = seed.technicianParts;

    this.drafts = [];
    this.repairRequests = [];
    this.repairQuotes = [];
    this.repairJobs = [];
    this.payments = [];
    this.technicianEarnings = [];
    this.payouts = [];
    this.refunds = [];
    this.webhookEvents = [];
    this.warranties = [];
    this.reviews = [];
    this.auditLogs = [];
    this.notifications = [];
    this.messages = [];
    this.uploadedAttachments = [];
    this.riskEvents = [];

    this.pg.resetMemoryDb();
  }

  /**
   * Direct SQL query execution against the PostgreSQL pool.
   */
  public async query(sql: string, params: any[] = []): Promise<any> {
    return this.pg.query(sql, params);
  }

  /**
   * Executes a sequence of database operations within an ACID transaction.
   * Rolls back completely if any exception occurs.
   */
  public async transaction<T>(callback: (client: TransactionClient) => Promise<T>): Promise<T> {
    // Take a snapshot of memory collections to guarantee rollback consistency
    const snapshot = {
      users: [...this.users.map((u) => ({ ...u }))],
      repairJobs: [...this.repairJobs.map((j) => ({ ...j }))],
      payments: [...this.payments.map((p) => ({ ...p }))],
      technicianEarnings: [...this.technicianEarnings.map((e) => ({ ...e }))],
      payouts: [...this.payouts.map((p) => ({ ...p }))],
      refunds: [...this.refunds.map((r) => ({ ...r }))],
      webhookEvents: [...this.webhookEvents.map((w) => ({ ...w }))],
      repairRequests: [...this.repairRequests.map((r) => ({ ...r }))],
      repairQuotes: [...this.repairQuotes.map((q) => ({ ...q }))],
      technicianParts: [...this.technicianParts.map((tp) => ({ ...tp }))],
    };

    try {
      const result = await this.pg.transaction(async (txClient) => {
        return callback(txClient);
      });
      return result;
    } catch (error) {
      // Revert in-memory snapshot on transaction failure
      this.users = snapshot.users;
      this.repairJobs = snapshot.repairJobs;
      this.payments = snapshot.payments;
      this.technicianEarnings = snapshot.technicianEarnings;
      this.payouts = snapshot.payouts;
      this.refunds = snapshot.refunds;
      this.webhookEvents = snapshot.webhookEvents;
      this.repairRequests = snapshot.repairRequests;
      this.repairQuotes = snapshot.repairQuotes;
      this.technicianParts = snapshot.technicianParts;
      throw error;
    }
  }

  /**
   * No-op save to maintain backward-compatibility with services without using fs.
   */
  public save(): void {
    // Persistence is handled relationally by pg pool / transactions
  }
}

export const db = Database.getInstance();
