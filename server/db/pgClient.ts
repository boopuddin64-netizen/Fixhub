import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool, PoolClient } from 'pg';
import { newDb, IMemoryDb, DataType } from 'pg-mem';
import { getInitialSeedData } from './seedData';

const safeFilename = typeof __filename !== 'undefined'
  ? __filename
  : (import.meta && import.meta.url ? fileURLToPath(import.meta.url) : process.cwd());

const safeDirname = typeof __dirname !== 'undefined'
  ? __dirname
  : path.dirname(safeFilename);

export interface TransactionClient {
  query: (sql: string, params?: any[]) => Promise<any>;
}

export class PostgresDatabase {
  private static instance: PostgresDatabase;
  public pool!: Pool;
  private memDb: IMemoryDb | null = null;
  private isMemory = false;
  /**
   * Resolves once the schema has been applied (and seed data written). The server awaits this before
   * it starts listening so a fresh database boots deterministically. Rejects if the schema cannot be applied.
   */
  public ready: Promise<void> = Promise.resolve();

  private constructor() {
    this.initPool();
  }

  public static getInstance(): PostgresDatabase {
    if (!PostgresDatabase.instance) {
      PostgresDatabase.instance = new PostgresDatabase();
    }
    return PostgresDatabase.instance;
  }

  private initPool() {
    const hasPostgresEnv = Boolean(
      process.env.DATABASE_URL ||
      process.env.PGHOST ||
      (process.env.SQL_HOST && !process.env.SQL_HOST.includes('mock'))
    );

    if (hasPostgresEnv && process.env.NODE_ENV === 'production') {
      try {
        if (process.env.DATABASE_URL) {
          this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: 10,
            idleTimeoutMillis: 30000,
          });
        } else {
          this.pool = new Pool({
            host: process.env.SQL_HOST || process.env.PGHOST || 'localhost',
            port: Number(process.env.PGPORT) || 5432,
            user: process.env.SQL_USER || process.env.PGUSER || 'fixhub_user',
            password: process.env.SQL_PASSWORD || process.env.PGPASSWORD || 'fixhub_password',
            database: process.env.SQL_DB_NAME || process.env.PGDATABASE || 'fixhub_db',
            max: 10,
            idleTimeoutMillis: 30000,
          });
        }
        this.isMemory = false;
        console.log('Connected to PostgreSQL database instance.');
        this.ready = this.executeSchema();
        // Avoid an unhandled rejection if nobody awaits `ready` (server.ts awaits it and exits on failure).
        this.ready.catch((e) => console.error('Database schema initialisation failed:', e?.message || e));
      } catch (err) {
        console.warn('Failed connecting to live PostgreSQL, falling back to embedded PostgreSQL engine:', err);
        this.initMemoryDb();
      }
    } else {
      this.initMemoryDb();
    }
  }

  private initMemoryDb() {
    this.isMemory = true;
    this.memDb = newDb();
    
    // Register common postgres functions if needed
    this.memDb.public.registerFunction({
      name: 'current_timestamp',
      returns: DataType.timestamp,
      implementation: () => new Date(),
    });

    const { Pool: MemPool } = this.memDb.adapters.createPg();
    this.pool = new MemPool();
    // In-memory engine: executeSchema runs synchronously up to completion for this branch.
    this.ready = this.executeSchema();
    this.ready.catch((e) => console.error('In-memory schema initialisation failed:', e?.message || e));
  }

  /** Advisory-lock key so that several instances booting at once do not run the DDL concurrently. */
  private static readonly SCHEMA_LOCK_KEY = 727463001;

  public async executeSchema(): Promise<void> {
    const schemaPath = path.resolve(safeDirname, 'schema.sql');
    let schemaSql = '';
    if (fs.existsSync(schemaPath)) {
      schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    } else {
      // Fallback relative to project root
      const rootSchemaPath = path.resolve(process.cwd(), 'server/db/schema.sql');
      if (fs.existsSync(rootSchemaPath)) {
        schemaSql = fs.readFileSync(rootSchemaPath, 'utf-8');
      }
    }

    if (!schemaSql) {
      if (process.env.NODE_ENV === 'production' && !this.memDb) {
        throw new Error('schema.sql not found: refusing to start production without a database schema.');
      }
      return;
    }

    // Strip comments
    const strippedSql = schemaSql
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((line) => line.replace(/--.*$/, '').trim())
      .join('\n');

    if (this.memDb) {
      // pg-mem: statement-by-statement (its parser is stricter), synchronous.
      const cleanSql = strippedSql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const statement of cleanSql) {
        try {
          this.memDb.public.none(statement);
        } catch (e: any) {
          // Ignore table already exists or minor extension warnings
          if (!String(e?.message).includes('already exists')) {
            console.warn('Schema execution warning:', e?.message);
          }
        }
      }
      await this.seedInitialData();
      return;
    }

    // Real PostgreSQL: run the whole file as ONE query on ONE connection, awaited, under an advisory
    // lock. (Previously each statement was fired un-awaited on a separate pooled connection, which
    // raced: "relation does not exist" errors, deadlocks and missing tables on a fresh database.)
    const client = await this.pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock($1)', [PostgresDatabase.SCHEMA_LOCK_KEY]);
      try {
        await client.query(strippedSql);
      } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [PostgresDatabase.SCHEMA_LOCK_KEY]).catch(() => {});
      }
    } finally {
      client.release();
    }
    await this.seedInitialData();
  }

  public async seedInitialData(): Promise<void> {
    try {
      const seed = getInitialSeedData();
      for (const user of seed.users) {
        if (this.memDb) {
          try {
            this.memDb.public.none(
              `INSERT INTO users (id, email, phone, name, role, avatar_url, password_hash, created_at)
               VALUES ('${user.id}', '${user.email}', '${user.phone}', '${user.name.replace(/'/g, "''")}', '${user.role}', ${user.avatarUrl ? `'${user.avatarUrl}'` : 'NULL'}, '${user.passwordHash}', '${user.createdAt}')
               ON CONFLICT (id) DO NOTHING`
            );
          } catch (_) {}
        } else {
          await this.pool.query(
            `INSERT INTO users (id, email, phone, name, role, avatar_url, password_hash, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO NOTHING`,
            [
              user.id,
              user.email,
              user.phone,
              user.name,
              user.role,
              user.avatarUrl || null,
              user.passwordHash,
              user.createdAt,
            ]
          );
        }
      }
    } catch (err) {
      console.warn('Failed seeding initial DB data:', err);
    }
  }

  public async query(sql: string, params: any[] = []): Promise<any> {
    return this.pool.query(sql, params);
  }

  /**
   * Executes a callback within a single database transaction boundary.
   * If any step throws an error, the transaction is completely rolled back.
   */
  public async transaction<T>(callback: (client: TransactionClient) => Promise<T>): Promise<T> {
    if (this.isMemory && this.memDb) {
      const backup = this.memDb.backup();
      try {
        const client: TransactionClient = {
          query: (sql: string, params: any[] = []) => this.pool.query(sql, params),
        };
        const result = await callback(client);
        return result;
      } catch (error) {
        backup.restore();
        throw error;
      }
    }

    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const txClient: TransactionClient = {
        query: (sql: string, params: any[] = []) => client.query(sql, params),
      };
      const result = await callback(txClient);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public resetMemoryDb() {
    if (this.isMemory) {
      this.initMemoryDb();
    }
  }
}

export const pgDb = PostgresDatabase.getInstance();
