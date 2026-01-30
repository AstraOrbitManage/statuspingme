import { db } from '../db';
import { jobQueue, type Job, type NewJob } from '../db/schema/job-queue';
import { eq, and, lte, sql } from 'drizzle-orm';

export type JobType = 'instant_digest' | 'daily_digest' | 'weekly_digest';

export interface JobPayload {
  instant_digest: {
    projectId: string;
    updateId: string;
    subscriberIds: string[];
  };
  daily_digest: {
    projectId: string;
  };
  weekly_digest: {
    projectId: string;
  };
}

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

const MAX_ATTEMPTS = 3;

/**
 * Add a job to the queue
 */
export async function enqueueJob<T extends JobType>(
  type: T,
  payload: JobPayload[T],
  scheduledFor?: Date
): Promise<Job> {
  const [job] = await db.insert(jobQueue).values({
    type,
    payload,
    status: 'pending',
    attempts: 0,
    scheduledFor: scheduledFor || new Date(),
  }).returning();
  
  console.log(`[Queue] Enqueued job ${job.id} (${type})`);
  return job;
}

/**
 * Get pending jobs that are ready to process
 */
export async function getPendingJobs(limit = 10): Promise<Job[]> {
  const jobs = await db
    .select()
    .from(jobQueue)
    .where(
      and(
        eq(jobQueue.status, 'pending'),
        lte(jobQueue.scheduledFor, new Date())
      )
    )
    .limit(limit);
  
  return jobs;
}

/**
 * Mark a job as processing
 */
export async function markJobProcessing(jobId: string): Promise<void> {
  await db
    .update(jobQueue)
    .set({
      status: 'processing',
      attempts: sql`${jobQueue.attempts} + 1`,
    })
    .where(eq(jobQueue.id, jobId));
}

/**
 * Mark a job as completed
 */
export async function markJobCompleted(jobId: string): Promise<void> {
  await db
    .update(jobQueue)
    .set({ status: 'completed' })
    .where(eq(jobQueue.id, jobId));
  
  console.log(`[Queue] Job ${jobId} completed`);
}

/**
 * Mark a job as failed
 * Will be retried if attempts < MAX_ATTEMPTS
 */
export async function markJobFailed(jobId: string, error: string): Promise<void> {
  const [job] = await db
    .select()
    .from(jobQueue)
    .where(eq(jobQueue.id, jobId));
  
  if (!job) return;
  
  const newAttempts = (job.attempts || 0) + 1;
  const newStatus = newAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
  
  await db
    .update(jobQueue)
    .set({
      status: newStatus,
      attempts: newAttempts,
      // Exponential backoff for retries: 1min, 4min, 9min
      scheduledFor: newStatus === 'pending' 
        ? new Date(Date.now() + newAttempts * newAttempts * 60 * 1000)
        : undefined,
    })
    .where(eq(jobQueue.id, jobId));
  
  if (newStatus === 'failed') {
    console.error(`[Queue] Job ${jobId} failed permanently after ${newAttempts} attempts: ${error}`);
  } else {
    console.log(`[Queue] Job ${jobId} failed, will retry (attempt ${newAttempts}/${MAX_ATTEMPTS})`);
  }
}

/**
 * Delete old completed/failed jobs (cleanup)
 */
export async function cleanupOldJobs(olderThanDays = 7): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  
  // First count how many we're about to delete
  const toDelete = await db
    .select({ id: jobQueue.id })
    .from(jobQueue)
    .where(
      and(
        sql`${jobQueue.status} IN ('completed', 'failed')`,
        lte(jobQueue.createdAt, cutoff)
      )
    );
  
  if (toDelete.length === 0) {
    return 0;
  }
  
  // Now delete them
  await db
    .delete(jobQueue)
    .where(
      and(
        sql`${jobQueue.status} IN ('completed', 'failed')`,
        lte(jobQueue.createdAt, cutoff)
      )
    );
  
  console.log(`[Queue] Cleaned up ${toDelete.length} old jobs (older than ${olderThanDays} days)`);
  return toDelete.length;
}

/**
 * Get job statistics
 */
export async function getJobStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}> {
  const stats = await db
    .select({
      status: jobQueue.status,
      count: sql<number>`count(*)::int`,
    })
    .from(jobQueue)
    .groupBy(jobQueue.status);
  
  const result = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    total: 0,
  };
  
  for (const row of stats) {
    const status = row.status as keyof typeof result;
    if (status in result) {
      result[status] = row.count;
    }
    result.total += row.count;
  }
  
  return result;
}
