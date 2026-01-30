import { db } from '../db';
import { sql } from 'drizzle-orm';
import { queueDailyDigests, queueWeeklyDigests, runJobProcessor } from './digest.job';
import { cleanupOldJobs } from './queue';

// Store last run times in memory (will reset on restart, but that's OK)
// In production, you might want to persist this in DB
interface ScheduleState {
  dailyDigest: Date | null;
  weeklyDigest: Date | null;
  cleanup: Date | null;
}

const scheduleState: ScheduleState = {
  dailyDigest: null,
  weeklyDigest: null,
  cleanup: null,
};

// Configuration
const DAILY_DIGEST_HOUR = 9; // 9 AM UTC
const WEEKLY_DIGEST_DAY = 0; // Sunday (0=Sun, 1=Mon, etc.)
const WEEKLY_DIGEST_HOUR = 10; // 10 AM UTC on Sundays
const CLEANUP_HOUR = 3; // 3 AM UTC for cleanup

/**
 * Check if daily digest should run
 * Runs once per day after DAILY_DIGEST_HOUR
 */
export function shouldRunDailyDigest(): boolean {
  const now = new Date();
  const todayTarget = new Date(now);
  todayTarget.setUTCHours(DAILY_DIGEST_HOUR, 0, 0, 0);
  
  // Not yet time today
  if (now < todayTarget) {
    return false;
  }
  
  // Already ran today
  if (scheduleState.dailyDigest && scheduleState.dailyDigest >= todayTarget) {
    return false;
  }
  
  return true;
}

/**
 * Check if weekly digest should run
 * Runs once per week on WEEKLY_DIGEST_DAY after WEEKLY_DIGEST_HOUR
 */
export function shouldRunWeeklyDigest(): boolean {
  const now = new Date();
  
  // Not the right day
  if (now.getUTCDay() !== WEEKLY_DIGEST_DAY) {
    return false;
  }
  
  const todayTarget = new Date(now);
  todayTarget.setUTCHours(WEEKLY_DIGEST_HOUR, 0, 0, 0);
  
  // Not yet time today
  if (now < todayTarget) {
    return false;
  }
  
  // Already ran this week
  if (scheduleState.weeklyDigest && scheduleState.weeklyDigest >= todayTarget) {
    return false;
  }
  
  return true;
}

/**
 * Check if cleanup should run
 * Runs once per day after CLEANUP_HOUR
 */
function shouldRunCleanup(): boolean {
  const now = new Date();
  const todayTarget = new Date(now);
  todayTarget.setUTCHours(CLEANUP_HOUR, 0, 0, 0);
  
  if (now < todayTarget) {
    return false;
  }
  
  if (scheduleState.cleanup && scheduleState.cleanup >= todayTarget) {
    return false;
  }
  
  return true;
}

/**
 * Run the scheduler tick
 * This should be called periodically (e.g., every 30 seconds)
 */
export async function runSchedulerTick(): Promise<void> {
  // Check and run daily digests
  if (shouldRunDailyDigest()) {
    console.log('[Scheduler] Running daily digest scheduling');
    try {
      await queueDailyDigests();
      scheduleState.dailyDigest = new Date();
      console.log('[Scheduler] Daily digest jobs queued successfully');
    } catch (error) {
      console.error('[Scheduler] Failed to queue daily digests:', error);
    }
  }
  
  // Check and run weekly digests
  if (shouldRunWeeklyDigest()) {
    console.log('[Scheduler] Running weekly digest scheduling');
    try {
      await queueWeeklyDigests();
      scheduleState.weeklyDigest = new Date();
      console.log('[Scheduler] Weekly digest jobs queued successfully');
    } catch (error) {
      console.error('[Scheduler] Failed to queue weekly digests:', error);
    }
  }
  
  // Check and run cleanup
  if (shouldRunCleanup()) {
    console.log('[Scheduler] Running job cleanup');
    try {
      const deleted = await cleanupOldJobs(7);
      scheduleState.cleanup = new Date();
      console.log(`[Scheduler] Cleanup completed, removed ${deleted} old jobs`);
    } catch (error) {
      console.error('[Scheduler] Failed to run cleanup:', error);
    }
  }
  
  // Always run the job processor
  await runJobProcessor();
}

/**
 * Get current scheduler state (for debugging/admin)
 */
export function getSchedulerState() {
  const now = new Date();
  
  return {
    currentTime: now.toISOString(),
    currentTimeUTC: {
      hour: now.getUTCHours(),
      day: now.getUTCDay(),
      dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getUTCDay()],
    },
    config: {
      dailyDigestHour: DAILY_DIGEST_HOUR,
      weeklyDigestDay: WEEKLY_DIGEST_DAY,
      weeklyDigestDayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][WEEKLY_DIGEST_DAY],
      weeklyDigestHour: WEEKLY_DIGEST_HOUR,
      cleanupHour: CLEANUP_HOUR,
    },
    lastRuns: {
      dailyDigest: scheduleState.dailyDigest?.toISOString() || null,
      weeklyDigest: scheduleState.weeklyDigest?.toISOString() || null,
      cleanup: scheduleState.cleanup?.toISOString() || null,
    },
    nextRunStatus: {
      dailyDigestPending: shouldRunDailyDigest(),
      weeklyDigestPending: shouldRunWeeklyDigest(),
      cleanupPending: shouldRunCleanup(),
    },
  };
}

/**
 * Manually trigger daily digests (for admin use)
 */
export async function triggerDailyDigests(): Promise<void> {
  console.log('[Scheduler] Manually triggering daily digests');
  await queueDailyDigests();
  // Don't update scheduleState here so scheduled run still happens if needed
}

/**
 * Manually trigger weekly digests (for admin use)
 */
export async function triggerWeeklyDigests(): Promise<void> {
  console.log('[Scheduler] Manually triggering weekly digests');
  await queueWeeklyDigests();
  // Don't update scheduleState here so scheduled run still happens if needed
}

/**
 * Start the scheduler
 * @param intervalMs How often to check for jobs (default 30 seconds)
 */
export function startScheduler(intervalMs = 30000): NodeJS.Timeout {
  console.log(`[Scheduler] Starting with ${intervalMs / 1000}s interval`);
  console.log(`[Scheduler] Daily digests at ${DAILY_DIGEST_HOUR}:00 UTC`);
  console.log(`[Scheduler] Weekly digests on ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][WEEKLY_DIGEST_DAY]} at ${WEEKLY_DIGEST_HOUR}:00 UTC`);
  console.log(`[Scheduler] Cleanup at ${CLEANUP_HOUR}:00 UTC`);
  
  // Run immediately on startup
  runSchedulerTick().catch(err => {
    console.error('[Scheduler] Error on startup tick:', err);
  });
  
  // Then run on interval
  return setInterval(() => {
    runSchedulerTick().catch(err => {
      console.error('[Scheduler] Error:', err);
    });
  }, intervalMs);
}
