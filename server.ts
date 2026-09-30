import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes/api';
import { validateProductionSecrets } from './server/config/envValidator';
import { db } from './server/db';
import { buildCorsOptions } from './server/config/cors';
import { cspReportRateLimiter } from './server/middleware/rateLimiters';
import { pgDb } from './server/db/pgClient';
import { getJwtSecret } from './server/services/authService';
import { bootstrapAdminFromEnv } from './server/services/adminAuthService';
import { buildCspMiddleware } from './server/config/csp';
import { globalErrorHandler, installProcessSafeguards } from './server/middleware/errorHandler';

installProcessSafeguards();

// Production Environment & Secret Validation - Fail fast before booting server
export function validateProductionStartup(
  env: NodeJS.ProcessEnv = process.env,
  exitOnError: boolean = true
): { valid: boolean } {
  if (env.NODE_ENV === 'production') {
    // 1. Paystack live key check
    const paystackKey = env.PAYSTACK_SECRET_KEY?.trim();
    if (
      !paystackKey ||
      paystackKey === '' ||
      paystackKey.toLowerCase().includes('mock') ||
      paystackKey.startsWith('sk_test')
    ) {
      const msg = 'FATAL: A valid live PAYSTACK_SECRET_KEY is required when NODE_ENV=production.';
      console.error(msg);
      if (exitOnError) {
        process.exit(1);
      }
      throw new Error(msg);
    }

    // 2. Database configuration check (refuse silent in-memory fallback)
    if (!env.DATABASE_URL && !env.PGHOST) {
      const msg = 'FATAL: DATABASE_URL or PGHOST must be set when NODE_ENV=production — refusing to start with in-memory storage.';
      console.error(msg);
      if (exitOnError) {
        process.exit(1);
      }
      throw new Error(msg);
    }

    // 3. Other security credentials
    validateProductionSecrets(env, exitOnError);
  }
  return { valid: true };
}

async function startServer() {
  // Production Secret & Database Validation - fail fast: a misconfigured production deploy must not
  // boot (default JWT secret / mock Paystack key / missing DB would be exploitable). validateProductionStartup
  // logs the reason and exits with a non-zero status.
  validateProductionStartup(process.env, true);
  if (process.env.NODE_ENV === 'production') {
    getJwtSecret(); // throws (and the startServer catch below exits) if unusable
  }

  // Wait for the database schema to be applied before accepting traffic (rejects -> process exits 1).
  await pgDb.ready;
  // Load durable state from PostgreSQL (or bootstrap an empty database) BEFORE accepting traffic.
  const { hydrated } = await db.init();
  console.log(hydrated ? '[db] Restored application state from PostgreSQL.' : '[db] Empty database initialised.');
  db.startBackgroundFlush();

  // Optional first-admin bootstrap for platforms without shell access (ADMIN_BOOTSTRAP_EMAIL + ADMIN_BOOTSTRAP_PASSWORD).
  // Only ever CREATES a missing admin (never touches an existing one) and forces a password change at first sign-in.
  const bootstrap = bootstrapAdminFromEnv(process.env);
  if (bootstrap) {
    if (!bootstrap.ok) console.error(`[admin] bootstrap skipped: ${bootstrap.error}`);
    else if (bootstrap.status === 'exists') console.warn(`[admin] ${bootstrap.email} already exists - remove ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD from the environment.`);
    else {
      console.warn(`[admin] admin ${bootstrap.email} ${bootstrap.status} from ADMIN_BOOTSTRAP_*: sign in at /admin, choose a new password, then REMOVE ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD from the environment.`);
      await db.flush().catch((e) => console.error('[admin] could not persist the bootstrap admin:', e?.message || e));
    }
  }

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Trust proxy for reverse proxy (Cloud Run / Nginx)
  app.set('trust proxy', 1);

  // Security Headers via helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // set below by buildCspMiddleware (production only; Vite dev needs inline scripts + HMR)
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false, // Essential for Google OAuth popups and mobile WebKit
      crossOriginResourcePolicy: false, // Allow external assets (Google Maps, Google Identity Services, Fonts)
      frameguard: false, // Allow iframe preview in AI Studio
    })
  );

  // Content-Security-Policy (production only). Default is report-only; set CSP_MODE=enforce once verified
  // against your real Google/Paystack/Maps configuration. See README "Content-Security-Policy".
  const csp = buildCspMiddleware(process.env);
  if (csp) {
    app.use(csp);
    app.post(
      '/api/csp-report',
      cspReportRateLimiter,
      express.json({ type: ['application/csp-report', 'application/reports+json', 'application/json'], limit: '16kb' }),
      (req, res) => {
        const r = (req.body && (req.body['csp-report'] || (Array.isArray(req.body) ? req.body[0]?.body : req.body))) || {};
        console.warn('[csp-report]', JSON.stringify(r).slice(0, 600));
        res.status(204).end();
      }
    );
  }

  // CORS: strict allow-list from ALLOWED_ORIGINS / APP_URL (+ localhost in non-production). See server/config/cors.ts
  app.use(cors(buildCorsOptions(process.env)));

  app.use(express.json({
    limit: '10mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Root health check endpoint
  app.get('/health', async (_req, res) => {
    let database = 'connected';
    try {
      if ((db as any).rawQuery) {
        await (db as any).rawQuery('SELECT 1');
      }
    } catch {
      database = 'unreachable';
    }
    return res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database,
    });
  });

  // API Routes FIRST
  app.use('/api', apiRouter);

  // Health check with detailed diagnostics
  app.get('/api/health', (_req, res) => {
    const memoryUsage = process.memoryUsage();
    res.json({
      status: 'ok',
      app: 'Fixhub API Engine',
      version: '1.0.0',
      time: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        type: process.env.DATABASE_URL ? 'PostgreSQL' : 'In-Memory / Synced',
        usersCount: db.users?.length || 0,
        jobsCount: db.repairJobs?.length || 0,
      },
      system: {
        heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        rssMB: Math.round(memoryUsage.rss / 1024 / 1024),
      },
    });
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global Error Handler (client errors keep their status, everything else is a generic 500)
  app.use(globalErrorHandler);

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Fix Hub Server running on http://0.0.0.0:${PORT}`);
  });

  // Graceful shutdown: stop accepting connections, flush pending writes, release the DB.
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] ${signal} received, flushing state and shutting down.`);
    httpServer.close();
    db.shutdown()
      .catch(() => {})
      .finally(() => pgDb.pool.end().catch(() => {}).finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Failed to start Fix Hub server:', err);
  // Never keep a half-started server alive (e.g. bad production config or schema failure).
  process.exit(1);
});
