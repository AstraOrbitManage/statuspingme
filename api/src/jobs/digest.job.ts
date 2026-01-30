import { db } from '../db';
import { digestSubscriptions, type DigestSubscription } from '../db/schema/digest-subscriptions';
import { updates, type Update } from '../db/schema/updates';
import { images, type Image } from '../db/schema/images';
import { links, type Link } from '../db/schema/links';
import { projects, type Project } from '../db/schema/projects';
import { eq, and, gt, inArray } from 'drizzle-orm';
import { 
  sendInstantUpdate,
  sendDailyDigest,
  sendWeeklyDigest,
  type UpdateWithMedia 
} from '../services/email.service';
import {
  enqueueJob,
  getPendingJobs,
  markJobProcessing,
  markJobCompleted,
  markJobFailed,
  type JobPayload,
} from './queue';

/**
 * Fetch updates with their associated images and links
 */
async function getUpdatesWithMedia(updateIds: string[]): Promise<UpdateWithMedia[]> {
  if (updateIds.length === 0) return [];
  
  const updatesData = await db
    .select()
    .from(updates)
    .where(inArray(updates.id, updateIds));
  
  const imagesData = await db
    .select()
    .from(images)
    .where(inArray(images.updateId, updateIds));
  
  const linksData = await db
    .select()
    .from(links)
    .where(inArray(links.updateId, updateIds));
  
  // Map images and links to their updates
  const imagesByUpdate = new Map<string, Image[]>();
  const linksByUpdate = new Map<string, Link[]>();
  
  for (const img of imagesData) {
    const list = imagesByUpdate.get(img.updateId) || [];
    list.push(img);
    imagesByUpdate.set(img.updateId, list);
  }
  
  for (const link of linksData) {
    const list = linksByUpdate.get(link.updateId) || [];
    list.push(link);
    linksByUpdate.set(link.updateId, list);
  }
  
  return updatesData.map(update => ({
    ...update,
    images: imagesByUpdate.get(update.id) || [],
    links: linksByUpdate.get(update.id) || [],
  }));
}

/**
 * Get project details
 */
async function getProject(projectId: string): Promise<Project | null> {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));
  return project || null;
}

/**
 * Update last_sent_at for subscriptions
 */
async function updateLastSentAt(subscriptionIds: string[]): Promise<void> {
  if (subscriptionIds.length === 0) return;
  
  await db
    .update(digestSubscriptions)
    .set({ lastSentAt: new Date() })
    .where(inArray(digestSubscriptions.id, subscriptionIds));
}

/**
 * Trigger instant digest for a new update
 * Called when a new update is posted
 */
export async function triggerInstantDigest(projectId: string, updateId: string): Promise<void> {
  // Get instant subscribers for this project
  const subscribers = await db
    .select()
    .from(digestSubscriptions)
    .where(
      and(
        eq(digestSubscriptions.projectId, projectId),
        eq(digestSubscriptions.frequency, 'instant')
      )
    );
  
  if (subscribers.length === 0) {
    console.log(`[Digest] No instant subscribers for project ${projectId}`);
    return;
  }
  
  console.log(`[Digest] Triggering instant digest for ${subscribers.length} subscribers`);
  
  // Queue the job
  await enqueueJob('instant_digest', {
    projectId,
    updateId,
    subscriberIds: subscribers.map(s => s.id),
  });
}

/**
 * Process instant digest job
 */
async function processInstantDigest(payload: JobPayload['instant_digest']): Promise<void> {
  const { projectId, updateId, subscriberIds } = payload;
  
  const project = await getProject(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }
  
  const updatesWithMedia = await getUpdatesWithMedia([updateId]);
  if (updatesWithMedia.length === 0) {
    throw new Error(`Update ${updateId} not found`);
  }
  
  const update = updatesWithMedia[0];
  
  // Get subscriber emails
  const subscribers = await db
    .select()
    .from(digestSubscriptions)
    .where(inArray(digestSubscriptions.id, subscriberIds));
  
  // Send instant notification to each subscriber using the proper template
  const successfulIds: string[] = [];
  const BATCH_SIZE = 5;
  
  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    
    const results = await Promise.all(
      batch.map(async (subscriber) => {
        const result = await sendInstantUpdate({
          to: subscriber.email,
          projectName: project.name,
          projectToken: project.magicLinkToken,
          projectColor: project.brandingColor || undefined,
          projectLogoUrl: project.brandingLogoUrl || undefined,
          update,
        });
        return { subscriberId: subscriber.id, result };
      })
    );
    
    for (const { subscriberId, result } of results) {
      if (result.success) {
        successfulIds.push(subscriberId);
      }
    }
  }
  
  // Update last_sent_at for successful sends
  await updateLastSentAt(successfulIds);
  
  const failCount = subscribers.length - successfulIds.length;
  console.log(`[Digest] Instant digest: ${successfulIds.length} sent, ${failCount} failed`);
}

/**
 * Process daily/weekly digest job
 */
async function processScheduledDigest(
  payload: JobPayload['daily_digest'] | JobPayload['weekly_digest'],
  frequency: 'daily' | 'weekly'
): Promise<void> {
  const { projectId } = payload;
  
  const project = await getProject(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }
  
  // Get subscribers for this frequency
  const subscribers = await db
    .select()
    .from(digestSubscriptions)
    .where(
      and(
        eq(digestSubscriptions.projectId, projectId),
        eq(digestSubscriptions.frequency, frequency)
      )
    );
  
  if (subscribers.length === 0) {
    console.log(`[Digest] No ${frequency} subscribers for project ${projectId}`);
    return;
  }
  
  // Calculate date range for weekly digest
  const now = new Date();
  const weekEndDate = new Date(now);
  const weekStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // For each subscriber, get updates since their last_sent_at
  for (const subscriber of subscribers) {
    const lastSent = subscriber.lastSentAt || new Date(0);
    
    const newUpdates = await db
      .select()
      .from(updates)
      .where(
        and(
          eq(updates.projectId, projectId),
          gt(updates.createdAt, lastSent)
        )
      );
    
    if (newUpdates.length === 0) {
      console.log(`[Digest] No new updates for subscriber ${subscriber.email}`);
      continue;
    }
    
    const updatesWithMedia = await getUpdatesWithMedia(newUpdates.map(u => u.id));
    
    let result;
    
    if (frequency === 'daily') {
      // Use daily digest template
      result = await sendDailyDigest({
        to: subscriber.email,
        projectName: project.name,
        projectToken: project.magicLinkToken,
        projectColor: project.brandingColor || undefined,
        projectLogoUrl: project.brandingLogoUrl || undefined,
        updates: updatesWithMedia,
      });
    } else {
      // Use weekly digest template
      result = await sendWeeklyDigest({
        to: subscriber.email,
        projectName: project.name,
        projectToken: project.magicLinkToken,
        projectColor: project.brandingColor || undefined,
        projectLogoUrl: project.brandingLogoUrl || undefined,
        updates: updatesWithMedia,
        weekStartDate,
        weekEndDate,
      });
    }
    
    if (result.success) {
      await updateLastSentAt([subscriber.id]);
      console.log(`[Digest] Sent ${frequency} digest to ${subscriber.email} with ${updatesWithMedia.length} updates`);
    } else {
      console.error(`[Digest] Failed to send ${frequency} digest to ${subscriber.email}: ${result.error}`);
    }
  }
}

/**
 * Process a single job from the queue
 */
export async function processJob(job: { id: string; type: string; payload: unknown }): Promise<void> {
  await markJobProcessing(job.id);
  
  try {
    switch (job.type) {
      case 'instant_digest':
        await processInstantDigest(job.payload as JobPayload['instant_digest']);
        break;
      case 'daily_digest':
        await processScheduledDigest(job.payload as JobPayload['daily_digest'], 'daily');
        break;
      case 'weekly_digest':
        await processScheduledDigest(job.payload as JobPayload['weekly_digest'], 'weekly');
        break;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
    
    await markJobCompleted(job.id);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await markJobFailed(job.id, errorMessage);
    throw error;
  }
}

/**
 * Run the job processor (call periodically or via cron)
 */
export async function runJobProcessor(): Promise<void> {
  const jobs = await getPendingJobs(10);
  
  if (jobs.length === 0) {
    return;
  }
  
  console.log(`[Digest] Processing ${jobs.length} pending jobs`);
  
  for (const job of jobs) {
    try {
      await processJob(job);
    } catch (error) {
      // Error already logged in processJob
      continue;
    }
  }
}

/**
 * Queue daily digests for all projects with daily subscribers
 * Call this from a scheduled job (e.g., at end of day)
 */
export async function queueDailyDigests(): Promise<void> {
  // Get distinct projects with daily subscribers
  const projectIds = await db
    .selectDistinct({ projectId: digestSubscriptions.projectId })
    .from(digestSubscriptions)
    .where(eq(digestSubscriptions.frequency, 'daily'));
  
  for (const { projectId } of projectIds) {
    await enqueueJob('daily_digest', { projectId });
  }
  
  console.log(`[Digest] Queued daily digests for ${projectIds.length} projects`);
}

/**
 * Queue weekly digests for all projects with weekly subscribers
 * Call this from a scheduled job (e.g., every Sunday)
 */
export async function queueWeeklyDigests(): Promise<void> {
  const projectIds = await db
    .selectDistinct({ projectId: digestSubscriptions.projectId })
    .from(digestSubscriptions)
    .where(eq(digestSubscriptions.frequency, 'weekly'));
  
  for (const { projectId } of projectIds) {
    await enqueueJob('weekly_digest', { projectId });
  }
  
  console.log(`[Digest] Queued weekly digests for ${projectIds.length} projects`);
}
