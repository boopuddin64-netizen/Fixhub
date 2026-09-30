import { Request, Response } from 'express';
import { db } from '../../db';
import { apiRouter } from './shared';

// 0. HEALTH CHECK ENDPOINT (Includes DB connectivity check)
apiRouter.get('/health', async (req: Request, res: Response) => {
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
