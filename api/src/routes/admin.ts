import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { jobQueue } from '../db/schema/job-queue.js';
import { projects } from '../db/schema/projects.js';
import { updates } from '../db/schema/updates.js';
import { images } from '../db/schema/images.js';
import { links } from '../db/schema/links.js';
import { eq, sql, desc, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { 
  triggerDailyDigests, 
  triggerWeeklyDigests,
  getSchedulerState,
} from '../jobs/scheduler.js';
import { cleanupOldJobs } from '../jobs/queue.js';
import {
  sendInstantUpdate,
  sendDailyDigest,
  sendWeeklyDigest,
  sendSubscriptionConfirmed,
  isEmailServiceReady,
  type UpdateWithMedia,
  type SubscriptionFrequency,
} from '../services/email.service.js';

const router = Router();

// All admin routes require authentication
router.use(requireAuth);

/**
 * GET /api/admin/jobs/status
 * Get job queue status and statistics
 */
router.get('/jobs/status', async (req: Request, res: Response) => {
  try {
    // Get job counts by status
    const statusCounts = await db
      .select({
        status: jobQueue.status,
        count: sql<number>`count(*)::int`,
      })
      .from(jobQueue)
      .groupBy(jobQueue.status);
    
    // Get job counts by type
    const typeCounts = await db
      .select({
        type: jobQueue.type,
        count: sql<number>`count(*)::int`,
      })
      .from(jobQueue)
      .groupBy(jobQueue.type);
    
    // Get recent jobs (last 20)
    const recentJobs = await db
      .select({
        id: jobQueue.id,
        type: jobQueue.type,
        status: jobQueue.status,
        attempts: jobQueue.attempts,
        scheduledFor: jobQueue.scheduledFor,
        createdAt: jobQueue.createdAt,
      })
      .from(jobQueue)
      .orderBy(desc(jobQueue.createdAt))
      .limit(20);
    
    // Get failed jobs (for debugging)
    const failedJobs = await db
      .select({
        id: jobQueue.id,
        type: jobQueue.type,
        payload: jobQueue.payload,
        attempts: jobQueue.attempts,
        createdAt: jobQueue.createdAt,
      })
      .from(jobQueue)
      .where(eq(jobQueue.status, 'failed'))
      .orderBy(desc(jobQueue.createdAt))
      .limit(10);
    
    // Get scheduler state
    const schedulerState = getSchedulerState();
    
    res.json({
      scheduler: schedulerState,
      statistics: {
        byStatus: Object.fromEntries(
          statusCounts.map(row => [row.status, row.count])
        ),
        byType: Object.fromEntries(
          typeCounts.map(row => [row.type, row.count])
        ),
      },
      recentJobs,
      failedJobs,
    });
  } catch (error) {
    console.error('[Admin] Jobs status error:', error);
    res.status(500).json({ error: 'Failed to get job status' });
  }
});

/**
 * POST /api/admin/digest/trigger-daily
 * Manually trigger daily digest for all projects with daily subscribers
 */
router.post('/digest/trigger-daily', async (req: Request, res: Response) => {
  try {
    console.log(`[Admin] Daily digest triggered by user ${req.user?.userId}`);
    await triggerDailyDigests();
    
    res.json({ 
      success: true, 
      message: 'Daily digests have been queued',
      triggeredBy: req.user?.email,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] Trigger daily digest error:', error);
    res.status(500).json({ error: 'Failed to trigger daily digest' });
  }
});

/**
 * POST /api/admin/digest/trigger-weekly
 * Manually trigger weekly digest for all projects with weekly subscribers
 */
router.post('/digest/trigger-weekly', async (req: Request, res: Response) => {
  try {
    console.log(`[Admin] Weekly digest triggered by user ${req.user?.userId}`);
    await triggerWeeklyDigests();
    
    res.json({ 
      success: true, 
      message: 'Weekly digests have been queued',
      triggeredBy: req.user?.email,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] Trigger weekly digest error:', error);
    res.status(500).json({ error: 'Failed to trigger weekly digest' });
  }
});

/**
 * POST /api/admin/jobs/cleanup
 * Manually trigger job cleanup
 */
router.post('/jobs/cleanup', async (req: Request, res: Response) => {
  try {
    const olderThanDays = parseInt(req.query.days as string) || 7;
    
    console.log(`[Admin] Job cleanup triggered by user ${req.user?.userId}`);
    const deleted = await cleanupOldJobs(olderThanDays);
    
    res.json({ 
      success: true, 
      message: `Cleaned up old jobs`,
      deletedCount: deleted,
      olderThanDays,
      triggeredBy: req.user?.email,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] Job cleanup error:', error);
    res.status(500).json({ error: 'Failed to cleanup jobs' });
  }
});

/**
 * DELETE /api/admin/jobs/:jobId
 * Delete a specific job (for cleaning up stuck/bad jobs)
 */
router.delete('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    const [deleted] = await db
      .delete(jobQueue)
      .where(eq(jobQueue.id, jobId))
      .returning({ id: jobQueue.id });
    
    if (!deleted) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    
    console.log(`[Admin] Job ${jobId} deleted by user ${req.user?.userId}`);
    
    res.json({ 
      success: true, 
      message: 'Job deleted',
      jobId,
    });
  } catch (error) {
    console.error('[Admin] Delete job error:', error);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

/**
 * POST /api/admin/jobs/:jobId/retry
 * Reset a failed job to pending for retry
 */
router.post('/jobs/:jobId/retry', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    const [job] = await db
      .select()
      .from(jobQueue)
      .where(eq(jobQueue.id, jobId));
    
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    
    if (job.status !== 'failed') {
      res.status(400).json({ error: 'Can only retry failed jobs' });
      return;
    }
    
    const [updated] = await db
      .update(jobQueue)
      .set({
        status: 'pending',
        attempts: 0,
        scheduledFor: new Date(),
      })
      .where(eq(jobQueue.id, jobId))
      .returning();
    
    console.log(`[Admin] Job ${jobId} reset for retry by user ${req.user?.userId}`);
    
    res.json({ 
      success: true, 
      message: 'Job reset for retry',
      job: updated,
    });
  } catch (error) {
    console.error('[Admin] Retry job error:', error);
    res.status(500).json({ error: 'Failed to retry job' });
  }
});

// ============================================================================
// Email Testing Endpoints
// ============================================================================

/**
 * GET /api/admin/email/status
 * Check if email service is configured
 */
router.get('/email/status', async (req: Request, res: Response) => {
  res.json({
    configured: isEmailServiceReady(),
    message: isEmailServiceReady() 
      ? 'Email service is configured and ready'
      : 'RESEND_API_KEY not configured - emails will be logged but not sent',
  });
});

/**
 * Helper to create a sample update for testing
 */
function createSampleUpdate(): UpdateWithMedia {
  const now = new Date();
  return {
    id: 'test-update-id',
    projectId: 'test-project-id',
    content: 'This is a **test update** with some content.\n\nIt demonstrates how updates appear in email notifications.\n\n- Point one\n- Point two\n- Point three',
    createdAt: now,
    images: [
      {
        id: 'test-image-1',
        updateId: 'test-update-id',
        url: 'https://via.placeholder.com/800x400/4F46E5/ffffff?text=Sample+Image',
        filename: 'sample-image.png',
        sizeBytes: 12345,
        createdAt: now,
      },
    ],
    links: [
      {
        id: 'test-link-1',
        updateId: 'test-update-id',
        url: 'https://example.com/demo',
        title: 'Example Link',
        description: 'A sample link to demonstrate link previews',
        imageUrl: 'https://via.placeholder.com/200x200/10B981/ffffff?text=Link',
        createdAt: now,
      },
    ],
  };
}

/**
 * POST /api/admin/email/test-instant
 * Send a test instant notification email
 */
router.post('/email/test-instant', async (req: Request, res: Response) => {
  try {
    const { email, projectId } = req.body;
    
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }
    
    let projectName = 'Test Project';
    let projectColor: string | undefined;
    let projectLogoUrl: string | undefined;
    let projectToken = 'test-token';
    
    // If projectId provided, use real project data
    if (projectId) {
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));
      
      if (project) {
        projectName = project.name;
        projectColor = project.brandingColor || undefined;
        projectLogoUrl = project.brandingLogoUrl || undefined;
        projectToken = project.magicLinkToken;
      }
    }
    
    console.log(`[Admin] Test instant email requested by ${req.user?.email} to ${email}`);
    
    const result = await sendInstantUpdate({
      to: email,
      projectName,
      projectToken,
      projectColor,
      projectLogoUrl,
      update: createSampleUpdate(),
    });
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Test instant notification sent',
        sentTo: email,
        messageId: result.messageId,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('[Admin] Test instant email error:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

/**
 * POST /api/admin/email/test-daily
 * Send a test daily digest email
 */
router.post('/email/test-daily', async (req: Request, res: Response) => {
  try {
    const { email, projectId } = req.body;
    
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }
    
    let projectName = 'Test Project';
    let projectColor: string | undefined;
    let projectLogoUrl: string | undefined;
    let projectToken = 'test-token';
    
    if (projectId) {
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));
      
      if (project) {
        projectName = project.name;
        projectColor = project.brandingColor || undefined;
        projectLogoUrl = project.brandingLogoUrl || undefined;
        projectToken = project.magicLinkToken;
      }
    }
    
    console.log(`[Admin] Test daily digest email requested by ${req.user?.email} to ${email}`);
    
    // Create multiple sample updates for digest
    const sampleUpdates: UpdateWithMedia[] = [
      { ...createSampleUpdate(), id: 'update-1', content: '**Morning Update:** Made good progress on the dashboard redesign. All components are now responsive.' },
      { ...createSampleUpdate(), id: 'update-2', content: '**Afternoon Update:** Fixed 3 bugs reported by QA team. Tests are now passing.', images: [], links: [] },
      { ...createSampleUpdate(), id: 'update-3', content: '**Evening Update:** Deployed to staging environment. Ready for review tomorrow.', images: [], links: [] },
    ];
    
    const result = await sendDailyDigest({
      to: email,
      projectName,
      projectToken,
      projectColor,
      projectLogoUrl,
      updates: sampleUpdates,
    });
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Test daily digest sent',
        sentTo: email,
        updateCount: sampleUpdates.length,
        messageId: result.messageId,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('[Admin] Test daily digest error:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

/**
 * POST /api/admin/email/test-weekly
 * Send a test weekly digest email
 */
router.post('/email/test-weekly', async (req: Request, res: Response) => {
  try {
    const { email, projectId } = req.body;
    
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }
    
    let projectName = 'Test Project';
    let projectColor: string | undefined;
    let projectLogoUrl: string | undefined;
    let projectToken = 'test-token';
    
    if (projectId) {
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));
      
      if (project) {
        projectName = project.name;
        projectColor = project.brandingColor || undefined;
        projectLogoUrl = project.brandingLogoUrl || undefined;
        projectToken = project.magicLinkToken;
      }
    }
    
    console.log(`[Admin] Test weekly digest email requested by ${req.user?.email} to ${email}`);
    
    // Create week's worth of sample updates
    const now = new Date();
    const weekStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const sampleUpdates: UpdateWithMedia[] = [
      { ...createSampleUpdate(), id: 'update-1', content: '**Week Start:** Kicked off the new sprint with planning session.', createdAt: new Date(weekStartDate.getTime() + 1 * 24 * 60 * 60 * 1000) },
      { ...createSampleUpdate(), id: 'update-2', content: '**Day 2:** Completed authentication module. All tests passing.', images: [], links: [], createdAt: new Date(weekStartDate.getTime() + 2 * 24 * 60 * 60 * 1000) },
      { ...createSampleUpdate(), id: 'update-3', content: '**Mid-week:** Dashboard components are 80% complete.', images: [], links: [], createdAt: new Date(weekStartDate.getTime() + 3 * 24 * 60 * 60 * 1000) },
      { ...createSampleUpdate(), id: 'update-4', content: '**Day 4:** API integration complete. Starting on email notifications.', images: [], links: [], createdAt: new Date(weekStartDate.getTime() + 4 * 24 * 60 * 60 * 1000) },
      { ...createSampleUpdate(), id: 'update-5', content: '**Week End:** Deployed v1.0 to production! 🎉', createdAt: new Date(weekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000) },
    ];
    
    const result = await sendWeeklyDigest({
      to: email,
      projectName,
      projectToken,
      projectColor,
      projectLogoUrl,
      updates: sampleUpdates,
      weekStartDate,
      weekEndDate: now,
    });
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Test weekly digest sent',
        sentTo: email,
        updateCount: sampleUpdates.length,
        weekRange: `${weekStartDate.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`,
        messageId: result.messageId,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('[Admin] Test weekly digest error:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

/**
 * POST /api/admin/email/test-confirmation
 * Send a test subscription confirmation email
 */
router.post('/email/test-confirmation', async (req: Request, res: Response) => {
  try {
    const { email, projectId, frequency } = req.body;
    
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }
    
    const validFrequencies: SubscriptionFrequency[] = ['instant', 'daily', 'weekly'];
    const normalizedFrequency: SubscriptionFrequency = validFrequencies.includes(frequency) 
      ? frequency 
      : 'instant';
    
    let projectName = 'Test Project';
    let projectColor: string | undefined;
    let projectLogoUrl: string | undefined;
    let projectToken = 'test-token';
    
    if (projectId) {
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));
      
      if (project) {
        projectName = project.name;
        projectColor = project.brandingColor || undefined;
        projectLogoUrl = project.brandingLogoUrl || undefined;
        projectToken = project.magicLinkToken;
      }
    }
    
    console.log(`[Admin] Test confirmation email requested by ${req.user?.email} to ${email}`);
    
    const result = await sendSubscriptionConfirmed({
      to: email,
      projectName,
      projectToken,
      projectColor,
      projectLogoUrl,
      frequency: normalizedFrequency,
    });
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Test subscription confirmation sent',
        sentTo: email,
        frequency: normalizedFrequency,
        messageId: result.messageId,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('[Admin] Test confirmation email error:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

export default router;
