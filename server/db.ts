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
import { EntityStore, PERSISTED_COLLECTIONS } from './db/entityStore';

/** Bank-change OTP state. Only a keyed hash of the code is ever kept (in memory or in the database). */
export interface BankOtpState {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
  verified: boolean;
  verifiedAt?: number;
}

/** Password-reset / e-mail / phone verification code. Only an HMAC of the code is kept. */
export interface VerificationCodeState {
  purpose: 'reset' | 'email' | 'phone';
  codeKey: string;
  codeHash: string;
  userId?: string;
  email?: string;
  phone?: string;
  createdAt: number;
  expiresAt: number;
}

/** Longest a verified OTP can still matter (30 min unlock window) — used to prune old rows. */
const BANK_OTP_RETENTION_MS = 45 * 60 * 1000;

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
    /** filled in by the admin portal when the event is reviewed */
    reviewedBy?: string;
    reviewedAt?: string;
    reviewNote?: string;
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
    reviewedBy?: string;
    reviewedAt?: string;
    reviewNote?: string;
  }> = [];

  /** SHA-256 hashes of revoked JWTs (logout / account deletion). Durable via the `revoked_tokens` table. */
  public revokedTokenHashes: Set<string> = new Set();
  /** Bank-change OTP state by technician id. Durable via the `bank_otps` table. */
  public bankOtps: Map<string, BankOtpState> = new Map();
  /** Reset / e-mail / phone verification codes, keyed `${purpose}:${codeKey}`. Durable via `verification_codes`. */
  public verificationCodes: Map<string, VerificationCodeState> = new Map();

  private readonly store = new EntityStore(
    (name) => (this as any)[name] as any[],
    (name, rows) => {
      (this as any)[name] = rows;
    }
  );
  /** true once init() completed: from then on every change is written through to PostgreSQL */
  private persistenceActive = false;
  private flushScheduled = false;
  private pendingFlush: Promise<void> | null = null;
  private backgroundTimer: NodeJS.Timeout | null = null;
  /** number of db.transaction() calls in flight; flushes wait for them so uncommitted state is never persisted */
  private txDepth = 0;
  private txIdle: Array<() => void> = [];
  private writerLockClient: { release: () => void } | null = null;

  private constructor() {
    this.resetToSeed();
  }

  public get isPersistent(): boolean {
    return this.persistenceActive;
  }

  /** true when this process holds the single-writer advisory lock (always false on the in-memory fallback) */
  public get holdsWriterLock(): boolean {
    return this.writerLockClient !== null;
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
    // Any explicit reset means "the database should now match the seed state": the next flush reconciles.
    this.store.reset();
    this.revokedTokenHashes = new Set();
    this.bankOtps = new Map();
    this.verificationCodes = new Map();
    if (this.persistenceActive) {
      this.store.queueWrite('DELETE FROM revoked_tokens', []);
      this.store.queueWrite('DELETE FROM bank_otps', []);
      this.store.queueWrite('DELETE FROM verification_codes', []);
      this.scheduleFlush();
    }
  }

  /**
   * Loads durable state from PostgreSQL (or bootstraps an empty database with the current in-memory seed
   * state) and switches on write-through persistence. Must complete before the server accepts traffic.
   * Calling it again re-hydrates from the database (used by restart tests).
   */
  public async init(): Promise<{ hydrated: boolean }> {
    await this.pg.ready;
    this.persistenceActive = false;
    await this.waitForPendingFlush();
    await this.acquireWriterLock();

    // Drop expired side-store rows first (cheap housekeeping, idempotent).
    await this.pg.query('DELETE FROM revoked_tokens WHERE expires_at <= $1', [new Date().toISOString()]);
    await this.pg.query('DELETE FROM bank_otps WHERE expires_at_ms < $1', [Date.now() - BANK_OTP_RETENTION_MS]);
    await this.pg.query('DELETE FROM verification_codes WHERE expires_at_ms < $1', [Date.now()]);

    const hydrated = await this.store.hydrate(this.pg);
    if (!hydrated) {
      // First boot on this database: the seed state (demo data outside production, catalog-only in
      // production) becomes the initial persisted state (written by the flush below, together with the
      // "bootstrapped" marker, in one transaction).
      this.store.reset();
    }

    const tokens = await this.pg.query('SELECT token_hash FROM revoked_tokens');
    this.revokedTokenHashes = new Set((tokens.rows || []).map((r: any) => String(r.token_hash)));
    const otps = await this.pg.query('SELECT * FROM bank_otps');
    this.bankOtps = new Map();
    for (const r of otps.rows || []) {
      this.bankOtps.set(String(r.technician_id), {
        codeHash: String(r.code_hash),
        attempts: Number(r.attempts),
        verified: Boolean(r.verified),
        createdAt: Number(r.created_at_ms),
        expiresAt: Number(r.expires_at_ms),
        verifiedAt: r.verified_at_ms === null || r.verified_at_ms === undefined ? undefined : Number(r.verified_at_ms),
      });
    }

    const codes = await this.pg.query('SELECT * FROM verification_codes');
    this.verificationCodes = new Map();
    for (const r of codes.rows || []) {
      const purpose = String(r.purpose) as VerificationCodeState['purpose'];
      this.verificationCodes.set(`${purpose}:${r.code_key}`, {
        purpose,
        codeKey: String(r.code_key),
        codeHash: String(r.code_hash),
        userId: r.user_id ?? undefined,
        email: r.email ?? undefined,
        phone: r.phone ?? undefined,
        createdAt: Number(r.created_at_ms),
        expiresAt: Number(r.expires_at_ms),
      });
    }

    this.persistenceActive = true;
    if (!hydrated) await this.flush();
    return { hydrated };
  }

  /**
   * TEST HELPER: behaves like a process restart against the same database — every in-memory collection,
   * the revocation set and the OTP map are dropped (without touching the database), then init() reloads
   * them from PostgreSQL.
   */
  public async simulateRestartForTests(): Promise<{ hydrated: boolean }> {
    await this.flush().catch(() => {});
    this.persistenceActive = false;
    for (const spec of PERSISTED_COLLECTIONS) (this as any)[spec.name] = [];
    this.revokedTokenHashes = new Set();
    this.bankOtps = new Map();
    this.verificationCodes = new Map();
    this.store.reset();
    return this.init();
  }

  /** Stops background work (timer, writer lock). Safe to call repeatedly. */
  public async shutdown(): Promise<void> {
    if (this.backgroundTimer) clearInterval(this.backgroundTimer);
    this.backgroundTimer = null;
    try {
      await this.flush();
    } catch (e: any) {
      console.error('[db] final flush failed:', e?.message || e);
    }
    this.persistenceActive = false;
    if (this.writerLockTimer) clearInterval(this.writerLockTimer);
    this.writerLockTimer = null;
    this.writerLockClient?.release();
    this.writerLockClient = null;
  }

  /**
   * Safety net for mutations that never call db.save(): flush on an interval. Unref'd, so it never keeps
   * the process (or a test run) alive.
   */
  public startBackgroundFlush(intervalMs = 5000): void {
    if (this.backgroundTimer) return;
    this.backgroundTimer = setInterval(() => {
      this.flush().catch((e) => console.error('[db] background flush failed:', e?.message || e));
    }, intervalMs);
    this.backgroundTimer.unref?.();
  }

  /**
   * Single-writer guard. Memory is the working copy of each process, so two processes writing the same
   * database would overwrite each other's entities. We hold a session-level PostgreSQL advisory lock for the
   * whole life of the process (real PostgreSQL only).
   *
   *  - Production: if another instance holds the lock we wait up to WRITER_LOCK_WAIT_MS (default 30s, so a
   *    rolling deploy where the old instance is draining can hand over) and then REFUSE TO START (init()
   *    rejects -> the server exits 1) instead of silently corrupting data. ALLOW_MULTI_INSTANCE=true
   *    downgrades this to a loud warning (unsupported: last writer wins).
   *  - Elsewhere: loud warning only.
   *  - A heartbeat on the lock connection detects a lost lock (connection dropped, failover) and re-acquires
   *    it; if another instance has taken it meanwhile in production, this process exits rather than keep writing.
   */
  private async acquireWriterLock(): Promise<void> {
    if (this.pg.isMemoryMode || this.writerLockClient) return;
    const isProd = process.env.NODE_ENV === 'production';
    const allowMulti = /^(1|true)$/i.test(process.env.ALLOW_MULTI_INSTANCE || '');
    const waitMs = isProd && !allowMulti ? Math.max(0, Number(process.env.WRITER_LOCK_WAIT_MS ?? 30_000) || 0) : 0;
    const deadline = Date.now() + waitMs;
    let announced = false;
    for (;;) {
      let client: any;
      try {
        client = await this.pg.pool.connect();
        const res = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [Database.WRITER_LOCK_KEY]);
        if (res.rows?.[0]?.ok) {
          client.on?.('error', (e: any) => console.error('[db] writer-lock connection error:', e?.message || e));
          this.writerLockClient = {
            release: () => {
              // Session locks outlive release() (the connection returns to the pool): unlock explicitly.
              client.query('SELECT pg_advisory_unlock($1)', [Database.WRITER_LOCK_KEY]).catch(() => {}).finally(() => client.release());
            },
          };
          this.startWriterLockHeartbeat(client);
          return;
        }
        client.release();
      } catch (e: any) {
        try { client?.release(true); } catch { /* ignore */ }
        console.error('[db] could not acquire writer lock:', e?.message || e);
        return; // DB problems surface elsewhere (schema / hydrate); do not mask them here
      }
      if (Date.now() >= deadline) break;
      if (!announced) {
        console.warn(`[db] another Fixhub instance holds the writer lock; waiting up to ${Math.round(waitMs / 1000)}s for it to exit...`);
        announced = true;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    const msg =
      'another Fixhub instance holds the writer lock on this database. Running more than one instance against the ' +
      'same database is NOT supported (state is cached per process; data would be overwritten).';
    if (isProd && !allowMulti) {
      throw new Error(`FATAL: ${msg} Stop the other instance (or set ALLOW_MULTI_INSTANCE=true to override at your own risk).`);
    }
    console.error(`[db] WARNING: ${msg}`);
  }

  private static readonly WRITER_LOCK_KEY = 727463002;
  private writerLockTimer: NodeJS.Timeout | null = null;

  private startWriterLockHeartbeat(client: any, intervalMs = Number(process.env.WRITER_LOCK_HEARTBEAT_MS) || 10_000): void {
    if (this.writerLockTimer) clearInterval(this.writerLockTimer);
    this.writerLockTimer = setInterval(async () => {
      try {
        // The lock lives and dies with this connection; a cheap round trip proves it is still alive.
        const res = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [Database.WRITER_LOCK_KEY]);
        if (res.rows?.[0]?.ok) {
          // Re-entrant on the same session: we still own it (or just re-took it). Balance the extra count.
          await client.query('SELECT pg_advisory_unlock($1)', [Database.WRITER_LOCK_KEY]);
        }
      } catch (e: any) {
        console.error('[db] writer lock connection lost:', e?.message || e);
        if (this.writerLockTimer) clearInterval(this.writerLockTimer);
        this.writerLockTimer = null;
        try { client.release(true); } catch { /* ignore */ }
        this.writerLockClient = null;
        try {
          await this.acquireWriterLock();
        } catch (fatal: any) {
          console.error(String(fatal?.message || fatal));
          process.exit(1);
        }
      }
    }, intervalMs);
    this.writerLockTimer.unref?.();
  }

  private waitForTransactions(): Promise<void> {
    if (this.txDepth === 0) return Promise.resolve();
    return new Promise((resolve) => this.txIdle.push(resolve));
  }

  private async waitForPendingFlush(): Promise<void> {
    try {
      await this.pendingFlush;
    } catch {
      /* reported by the caller that started it */
    }
  }

  /** Queue a small side-table write (token revocation, OTP) to be committed with the next flush. */
  public queueWrite(sql: string, params: any[]): void {
    if (!this.persistenceActive) return;
    this.store.queueWrite(sql, params);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    setImmediate(() => {
      this.flushScheduled = false;
      this.flush().catch((e) => console.error('[db] persistence flush failed (will be retried):', e?.message || e));
    });
  }

  /**
   * Durably writes every pending change in ONE transaction. Resolves after COMMIT. Callers that arrive
   * while a flush is already waiting for its turn share it. Rejects if the write failed (the changes stay
   * pending and are retried by the next flush).
   */
  public flush(): Promise<void> {
    if (!this.persistenceActive) return Promise.resolve();
    if (this.pendingFlush) return this.pendingFlush;
    const run = (async () => {
      await this.waitForTransactions();
      const release = await this.store.acquire();
      this.pendingFlush = null;
      try {
        if (!this.persistenceActive) return;
        const plan = await this.store.buildPlan(this.pg);
        if (plan.isEmpty) return;
        await this.pg.transaction((tx) => plan.execute(tx));
        plan.markCommitted();
      } catch (e) {
        if (this.pg.isMemoryMode) this.store.invalidate();
        throw e;
      } finally {
        release();
      }
    })();
    this.pendingFlush = run;
    run.catch(() => {});
    return run;
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
    // Snapshot of memory collections so a failed transaction leaves memory consistent with the database.
    // (deep copies: entities carry nested arrays such as statusHistory that callbacks mutate in place)
    const snap = (rows: any[]) => rows.map((r) => structuredClone(r));
    const snapshot = {
      users: snap(this.users),
      repairJobs: snap(this.repairJobs),
      payments: snap(this.payments),
      technicianEarnings: snap(this.technicianEarnings),
      payouts: snap(this.payouts),
      refunds: snap(this.refunds),
      webhookEvents: snap(this.webhookEvents),
      repairRequests: snap(this.repairRequests),
      repairQuotes: snap(this.repairQuotes),
      technicianParts: snap(this.technicianParts),
    };

    this.txDepth++;
    let release: (() => void) | null = null;
    let plan: Awaited<ReturnType<EntityStore['buildPlan']>> | null = null;
    try {
      return await this.pg.transaction(callback, {
        // The entity documents are written in the SAME transaction, so e.g. "payment SUCCESS + job BOOKED
        // + earnings HELD" become durable atomically together with the relational money rows.
        beforeCommit: this.persistenceActive
          ? async (tx) => {
              release = await this.store.acquire();
              plan = await this.store.buildPlan(tx);
              if (!plan.isEmpty) await plan.execute(tx);
            }
          : undefined,
        afterCommit: () => plan?.markCommitted(),
      });
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
      if (this.pg.isMemoryMode) this.store.invalidate(); // pg-mem restore may also have rolled back interleaved flushes
      throw error;
    } finally {
      (release as (() => void) | null)?.();
      this.txDepth--;
      if (this.txDepth === 0) {
        const waiters = this.txIdle;
        this.txIdle = [];
        waiters.forEach((w) => w());
      }
    }
  }

  /**
   * Marks in-memory changes as pending: they are written to PostgreSQL shortly afterwards (coalesced).
   * HTTP mutations additionally wait for `flush()` before the response is sent (see apiRouter), so an
   * acknowledged write is durable. Does nothing until init() has enabled persistence.
   */
  public save(): void {
    if (!this.persistenceActive) return;
    this.scheduleFlush();
  }
}

export const db = Database.getInstance();
