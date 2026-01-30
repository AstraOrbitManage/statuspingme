import { Router, Request, Response } from 'express';
import { checkDatabaseConnection } from '../db/index.js';
import { isEmailServiceReady } from '../services/email.service.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const dbConnected = await checkDatabaseConnection();
  const emailReady = isEmailServiceReady();
  
  res.json({
    status: dbConnected ? 'ok' : 'degraded',
    services: {
      database: dbConnected ? 'connected' : 'disconnected',
      email: emailReady ? 'configured' : 'not_configured',
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
