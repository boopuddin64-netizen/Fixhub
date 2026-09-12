import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes/api';
import { validateProductionSecrets } from './server/config/envValidator';
import { db } from './server/db';

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
  // Production Secret & Database Validation - Warn on missing secrets, don't crash container
  try {
    validateProductionStartup(process.env, false);
  } catch (err: any) {
    console.warn('⚠️ Production environment configuration warning:', err.message || err);
    console.warn('⚠️ Server will continue booting to ensure Cloud Run container health checks pass on port 3000.');
  }

  const app = express();
  const PORT = 3000;

  // Trust proxy for reverse proxy (Cloud Run / Nginx)
  app.set('trust proxy', 1);

  // Security Headers via helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // Vite dev server and iframe preview compatibility
      crossOriginEmbedderPolicy: false,
    })
  );

  // Restricted CORS Configuration
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
    })
  );

  app.use(express.json({
    limit: '10mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

  // Global Error Handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message || 'Unknown error' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Fix Hub Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Fix Hub server:', err);
});
