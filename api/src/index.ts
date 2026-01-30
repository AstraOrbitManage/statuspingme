import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import projectsRouter from './routes/projects.js';
import uploadsRouter from './routes/uploads.js';
import linksRouter from './routes/links.js';
import publicRouter from './routes/public.js';
import adminRouter from './routes/admin.js';
import { startScheduler } from './jobs/scheduler.js';
import { isEmailServiceReady } from './services/email.service.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/links', linksRouter);
app.use('/api/public', publicRouter);
app.use('/api/admin', adminRouter);

// Start server
app.listen(env.PORT, () => {
  console.log(`🚀 SitRep API running on http://localhost:${env.PORT}`);
  console.log(`   Health check: http://localhost:${env.PORT}/health`);
  console.log(`   Auth routes:  http://localhost:${env.PORT}/api/auth`);
  console.log(`   Project routes: http://localhost:${env.PORT}/api/projects`);
  console.log(`   Upload routes: http://localhost:${env.PORT}/api/uploads`);
  console.log(`   Links routes: http://localhost:${env.PORT}/api/links`);
  console.log(`   Public routes: http://localhost:${env.PORT}/api/public`);
  console.log(`   Admin routes: http://localhost:${env.PORT}/api/admin`);
  
  // Email service status
  if (isEmailServiceReady()) {
    console.log(`   📧 Email service: Ready`);
  } else {
    console.log(`   📧 Email service: Not configured (RESEND_API_KEY missing)`);
  }
  
  // Start scheduler (includes job processor, runs every 30 seconds)
  const SCHEDULER_INTERVAL_MS = 30 * 1000;
  startScheduler(SCHEDULER_INTERVAL_MS);
  console.log(`   🔄 Scheduler: Running every ${SCHEDULER_INTERVAL_MS / 1000}s`);
});
