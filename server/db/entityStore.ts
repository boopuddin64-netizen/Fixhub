/**
 * Write-through persistence for the application's in-memory entity collections.
 *
 * The services mutate `db.users`, `db.repairJobs`, ... directly (push / field assignment) and call the
 * legacy `db.save()`. Rather than rewrite ~3,000 lines of call sites, persistence is diff based:
 *   - `buildPlan()` serialises every persisted collection, compares each entity with the JSON that was
 *     last committed and produces upserts (new/changed) and deletes (removed);
 *   - a plan is executed inside ONE database transaction, so related changes (payment SUCCESS + job
 *     BOOKED + earnings HELD ...) become durable atomically or not at all;
 *   - the "last committed" snapshot is only advanced after COMMIT, so a failed flush is retried in full
 *     by the next one.
 * Flushes are serialised by an in-process mutex (see Database.transaction / Database.flush, which run the
 * plan inside the caller's transaction so money-related SQL and the entity documents commit atomically).
 * Small side writes (revoked tokens, bank OTPs) are queued with `queueWrite()` and ride along.
 */
export interface CollectionSpec {
  name: string;
  /** property that identifies an entity (default `id`) */
  key?: string;
  /** hydrate order: `insert` = DB insertion order, `newestFirst` = createdAt descending (arrays built with unshift) */
  order?: 'insert' | 'newestFirst';
  /** entities are never modified after creation (skip re-serialising ones already stored) */
  appendOnly?: boolean;
}

export const PERSISTED_COLLECTIONS: CollectionSpec[] = [
  { name: 'users' },
  { name: 'customerProfiles', key: 'userId' },
  { name: 'technicianProfiles', key: 'userId' },
  { name: 'customerDevices' },
  { name: 'drafts' },
  { name: 'repairRequests', order: 'newestFirst' },
  { name: 'repairQuotes' },
  { name: 'repairJobs' },
  { name: 'technicianParts' },
  { name: 'payments' },
  { name: 'technicianEarnings' },
  { name: 'payouts' },
  { name: 'refunds' },
  { name: 'webhookEvents', appendOnly: true },
  { name: 'warranties' },
  { name: 'reviews' },
  { name: 'auditLogs', appendOnly: true },
  { name: 'notifications', order: 'newestFirst' },
  { name: 'messages', appendOnly: true },
  { name: 'uploadedAttachments' },
  { name: 'riskEvents' },
];

export interface Executor {
  query: (sql: string, params?: any[]) => Promise<any>;
}

interface QueuedWrite {
  sql: string;
  params: any[];
}

const META_COLLECTION = '__meta__';
const META_BOOTSTRAP_ID = 'bootstrapped';
const CHUNK = 200;

/** jsonb cannot store U+0000; strip it so one hostile string can never make every later flush fail. */
function serialise(entity: unknown): string {
  return JSON.stringify(entity, (_k, v) => (typeof v === 'string' && v.indexOf('\u0000') !== -1 ? v.replace(/\u0000/g, '') : v));
}

export interface FlushPlan {
  isEmpty: boolean;
  execute(tx: Executor): Promise<void>;
  /** call after the transaction COMMITTED */
  markCommitted(): void;
}

export class EntityStore {
  /** collection -> id -> JSON last committed to the database */
  private known = new Map<string, Map<string, string>>();
  /** false after a reset: the next flush reconciles against the ids that exist in the database */
  private reconciled = true;
  /** the `__meta__/bootstrapped` marker row exists in the database */
  private markerWritten = false;
  private queue: QueuedWrite[] = [];
  private tail: Promise<void> = Promise.resolve();
  private queuedFlush: Promise<void> | null = null;
  public lastError: unknown = null;

  constructor(
    private readonly read: (name: string) => any[],
    private readonly write: (name: string, rows: any[]) => void,
    private readonly specs: CollectionSpec[] = PERSISTED_COLLECTIONS
  ) {
    for (const s of specs) this.known.set(s.name, new Map());
  }

  private keyOf(spec: CollectionSpec, entity: any): string | undefined {
    const v = entity?.[spec.key || 'id'];
    return v === undefined || v === null || v === '' ? undefined : String(v);
  }

  /** Forget everything that was committed (used when the in-memory state is reset to seed data). */
  public reset(): void {
    for (const s of this.specs) this.known.set(s.name, new Map());
    this.queue = [];
    this.reconciled = false;
    this.markerWritten = false;
  }

  /**
   * The database may have been rolled back underneath us (pg-mem restore): forget what we believe is
   * committed and reconcile with the real contents on the next flush. Queued side writes are kept.
   */
  public invalidate(): void {
    for (const s of this.specs) this.known.set(s.name, new Map());
    this.reconciled = false;
  }

  public queueWrite(sql: string, params: any[]): void {
    this.queue.push({ sql, params });
  }

  public get pendingWrites(): number {
    return this.queue.length;
  }

  /** In-process mutex. Resolves to a release function. */
  public acquire(): Promise<() => void> {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const prev = this.tail;
    this.tail = prev.then(() => gate);
    return prev.then(() => release);
  }

  /**
   * Loads the persisted state into the in-memory collections. Returns true when the database already
   * held application state; false when it was empty (caller keeps the seed data and bootstraps it).
   */
  public async hydrate(exec: Executor): Promise<boolean> {
    const release = await this.acquire();
    try {
      const res = await exec.query('SELECT collection, id, doc FROM entity_store ORDER BY collection, seq');
      const rows: Array<{ collection: string; id: string; doc: any }> = res.rows || [];
      const bootstrapped = rows.some((r) => r.collection === META_COLLECTION && r.id === META_BOOTSTRAP_ID);
      if (!bootstrapped) return false;

      const byCollection = new Map<string, any[]>();
      for (const r of rows) {
        if (r.collection === META_COLLECTION) continue;
        if (!byCollection.has(r.collection)) byCollection.set(r.collection, []);
        byCollection.get(r.collection)!.push(typeof r.doc === 'string' ? JSON.parse(r.doc) : r.doc);
      }
      for (const spec of this.specs) {
        const docs = byCollection.get(spec.name) || [];
        if (spec.order === 'newestFirst') {
          docs.sort((a, b) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')));
        }
        this.write(spec.name, docs);
        const map = new Map<string, string>();
        for (const d of docs) {
          const k = this.keyOf(spec, d);
          if (k) map.set(k, spec.appendOnly ? '' : serialise(d));
        }
        this.known.set(spec.name, map);
      }
      this.reconciled = true;
      this.markerWritten = true;
      return true;
    } finally {
      release();
    }
  }

  /** Computes what has to be written so the database matches memory. Must be called while holding the mutex. */
  public async buildPlan(exec?: Executor): Promise<FlushPlan> {
    let dbIds: Map<string, Set<string>> | null = null;
    if (!this.reconciled && exec) {
      const res = await exec.query('SELECT collection, id FROM entity_store');
      dbIds = new Map();
      for (const r of res.rows || []) {
        if (r.collection === META_COLLECTION) continue;
        if (!dbIds.has(r.collection)) dbIds.set(r.collection, new Set());
        dbIds.get(r.collection)!.add(String(r.id));
      }
    }

    const upserts: Array<{ collection: string; id: string; json: string }> = [];
    const deletes: Array<{ collection: string; id: string }> = [];

    for (const spec of this.specs) {
      const known = this.known.get(spec.name)!;
      const seen = new Set<string>();
      for (const entity of this.read(spec.name) || []) {
        const id = this.keyOf(spec, entity);
        if (!id) {
          console.error(`[persistence] ${spec.name}: entity without "${spec.key || 'id'}" is not persisted`);
          continue;
        }
        seen.add(id);
        if (spec.appendOnly && known.has(id)) continue;
        let json: string;
        try {
          json = serialise(entity);
        } catch (e: any) {
          console.error(`[persistence] ${spec.name}/${id} is not serialisable:`, e?.message);
          continue;
        }
        if (known.get(id) !== json) upserts.push({ collection: spec.name, id, json });
      }
      for (const id of known.keys()) if (!seen.has(id)) deletes.push({ collection: spec.name, id });
      const stale = dbIds?.get(spec.name);
      if (stale) for (const id of stale) if (!seen.has(id) && !known.has(id)) deletes.push({ collection: spec.name, id });
    }
    const queued = this.queue.length;
    const writeMarker = !this.markerWritten;
    const isEmpty = !writeMarker && upserts.length === 0 && deletes.length === 0 && queued === 0 && this.reconciled;

    return {
      isEmpty,
      execute: async (tx: Executor) => {
        for (let i = 0; i < upserts.length; i += CHUNK) {
          const part = upserts.slice(i, i + CHUNK);
          const values = part.map((_, n) => `($${n * 3 + 1}, $${n * 3 + 2}, $${n * 3 + 3}::jsonb)`).join(', ');
          const params = part.flatMap((u) => [u.collection, u.id, u.json]);
          await tx.query(
            `INSERT INTO entity_store (collection, id, doc) VALUES ${values}
             ON CONFLICT (collection, id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = CURRENT_TIMESTAMP`,
            params
          );
        }
        for (const d of deletes) {
          await tx.query('DELETE FROM entity_store WHERE collection = $1 AND id = $2', [d.collection, d.id]);
        }
        if (writeMarker) {
          await tx.query(
            `INSERT INTO entity_store (collection, id, doc) VALUES ($1, $2, $3::jsonb) ON CONFLICT (collection, id) DO NOTHING`,
            [META_COLLECTION, META_BOOTSTRAP_ID, JSON.stringify({ at: new Date().toISOString() })]
          );
        }
        for (let i = 0; i < queued; i++) {
          await tx.query(this.queue[i].sql, this.queue[i].params);
        }
      },
      markCommitted: () => {
        for (const u of upserts) {
          const spec = this.specs.find((x) => x.name === u.collection);
          this.known.get(u.collection)!.set(u.id, spec?.appendOnly ? '' : u.json);
        }
        for (const d of deletes) this.known.get(d.collection)?.delete(d.id);
        this.queue.splice(0, queued);
        this.reconciled = true;
        if (writeMarker) this.markerWritten = true;
      },
    };
  }
}
