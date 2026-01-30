import { Resend } from 'resend';
import { env } from '../config/env';

// Import all template generators
import {
  // Instant update
  generateInstantSubject,
  generateInstantHtml,
  generateInstantText,
  type InstantUpdateEmailData,
  type UpdateWithMedia,
  // Daily digest
  generateDailySubject,
  generateDailyHtml,
  generateDailyText,
  type DailyDigestEmailData,
  // Weekly digest
  generateWeeklySubject,
  generateWeeklyHtml,
  generateWeeklyText,
  type WeeklyDigestEmailData,
  // Subscription confirmation
  generateConfirmationSubject,
  generateConfirmationHtml,
  generateConfirmationText,
  type SubscriptionConfirmedEmailData,
  type SubscriptionFrequency,
  // Legacy (for backward compatibility)
  generateSubject as generateLegacySubject,
  generateHtml as generateLegacyHtml,
  generateText as generateLegacyText,
  type NotificationEmailData,
} from '../templates';

// Re-export types for convenience
export type { 
  UpdateWithMedia, 
  InstantUpdateEmailData,
  DailyDigestEmailData,
  WeeklyDigestEmailData,
  SubscriptionConfirmedEmailData,
  SubscriptionFrequency,
  NotificationEmailData,
};

// Initialize Resend client lazily to handle missing API key gracefully
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    if (!env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Generate timeline and unsubscribe URLs for a project
 * Uses the magic link token for public URLs
 */
function generateUrls(projectToken: string, email: string): { 
  timelineUrl: string; 
  unsubscribeUrl: string;
  managePreferencesUrl: string;
} {
  const baseUrl = env.APP_URL;
  const encodedEmail = encodeURIComponent(email);
  
  return {
    timelineUrl: `${baseUrl}/p/${projectToken}`,
    unsubscribeUrl: `${baseUrl}/p/${projectToken}/unsubscribe?email=${encodedEmail}`,
    managePreferencesUrl: `${baseUrl}/p/${projectToken}?email=${encodedEmail}`,
  };
}

/**
 * Core email sending function
 */
async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<EmailSendResult> {
  const { to, subject, html, text } = params;

  // Skip if no API key configured (development mode)
  if (!env.RESEND_API_KEY) {
    console.log('[Email] RESEND_API_KEY not configured, skipping email send');
    console.log('[Email] Would send to:', to);
    console.log('[Email] Subject:', subject);
    return { success: true, messageId: 'dev-mode-skipped' };
  }

  try {
    const resend = getResendClient();
    
    const result = await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
      text,
    });

    if (result.error) {
      console.error('[Email] Resend API error:', result.error);
      return { 
        success: false, 
        error: result.error.message || 'Unknown Resend error' 
      };
    }

    console.log(`[Email] Sent to ${to}: ${subject}`);
    return { 
      success: true, 
      messageId: result.data?.id 
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Email] Failed to send:', errorMessage);
    return { 
      success: false, 
      error: errorMessage 
    };
  }
}

// ============================================================================
// Instant Update Notifications
// ============================================================================

export interface SendInstantUpdateParams {
  to: string;
  projectName: string;
  projectToken: string;  // Magic link token for URL generation
  projectColor?: string;
  projectLogoUrl?: string;
  update: UpdateWithMedia;
}

/**
 * Send an instant update notification email
 */
export async function sendInstantUpdate(params: SendInstantUpdateParams): Promise<EmailSendResult> {
  const { to, projectName, projectToken, projectColor, projectLogoUrl, update } = params;
  const urls = generateUrls(projectToken, to);
  
  const data: InstantUpdateEmailData = {
    projectName,
    projectColor,
    projectLogoUrl,
    update,
    timelineUrl: urls.timelineUrl,
    unsubscribeUrl: urls.unsubscribeUrl,
  };

  return sendEmail({
    to,
    subject: generateInstantSubject(data),
    html: generateInstantHtml(data),
    text: generateInstantText(data),
  });
}

// ============================================================================
// Daily Digest
// ============================================================================

export interface SendDailyDigestParams {
  to: string;
  projectName: string;
  projectToken: string;  // Magic link token for URL generation
  projectColor?: string;
  projectLogoUrl?: string;
  updates: UpdateWithMedia[];
}

/**
 * Send a daily digest email
 */
export async function sendDailyDigest(params: SendDailyDigestParams): Promise<EmailSendResult> {
  const { to, projectName, projectToken, projectColor, projectLogoUrl, updates } = params;
  const urls = generateUrls(projectToken, to);
  
  const data: DailyDigestEmailData = {
    projectName,
    projectColor,
    projectLogoUrl,
    updates,
    timelineUrl: urls.timelineUrl,
    unsubscribeUrl: urls.unsubscribeUrl,
    managePreferencesUrl: urls.managePreferencesUrl,
  };

  return sendEmail({
    to,
    subject: generateDailySubject(data),
    html: generateDailyHtml(data),
    text: generateDailyText(data),
  });
}

// ============================================================================
// Weekly Digest
// ============================================================================

export interface SendWeeklyDigestParams {
  to: string;
  projectName: string;
  projectToken: string;  // Magic link token for URL generation
  projectColor?: string;
  projectLogoUrl?: string;
  updates: UpdateWithMedia[];
  weekStartDate: Date;
  weekEndDate: Date;
}

/**
 * Send a weekly digest email
 */
export async function sendWeeklyDigest(params: SendWeeklyDigestParams): Promise<EmailSendResult> {
  const { to, projectName, projectToken, projectColor, projectLogoUrl, updates, weekStartDate, weekEndDate } = params;
  const urls = generateUrls(projectToken, to);
  
  const data: WeeklyDigestEmailData = {
    projectName,
    projectColor,
    projectLogoUrl,
    updates,
    timelineUrl: urls.timelineUrl,
    unsubscribeUrl: urls.unsubscribeUrl,
    managePreferencesUrl: urls.managePreferencesUrl,
    weekStartDate,
    weekEndDate,
  };

  return sendEmail({
    to,
    subject: generateWeeklySubject(data),
    html: generateWeeklyHtml(data),
    text: generateWeeklyText(data),
  });
}

// ============================================================================
// Subscription Confirmation
// ============================================================================

export interface SendSubscriptionConfirmedParams {
  to: string;
  projectName: string;
  projectToken: string;  // Magic link token for URL generation
  projectColor?: string;
  projectLogoUrl?: string;
  frequency: SubscriptionFrequency;
}

/**
 * Send a subscription confirmation email
 */
export async function sendSubscriptionConfirmed(params: SendSubscriptionConfirmedParams): Promise<EmailSendResult> {
  const { to, projectName, projectToken, projectColor, projectLogoUrl, frequency } = params;
  const urls = generateUrls(projectToken, to);
  
  const data: SubscriptionConfirmedEmailData = {
    projectName,
    projectColor,
    projectLogoUrl,
    frequency,
    timelineUrl: urls.timelineUrl,
    unsubscribeUrl: urls.unsubscribeUrl,
    managePreferencesUrl: urls.managePreferencesUrl,
  };

  return sendEmail({
    to,
    subject: generateConfirmationSubject(data),
    html: generateConfirmationHtml(data),
    text: generateConfirmationText(data),
  });
}

// ============================================================================
// Legacy API (for backward compatibility)
// ============================================================================

export interface SendUpdateNotificationParams {
  to: string;
  projectName: string;
  projectToken: string;  // Magic link token for URL generation
  projectColor?: string;
  updates: UpdateWithMedia[];
  isDigest?: boolean;
}

/**
 * Send an update notification email (legacy API)
 * @deprecated Use sendInstantUpdate, sendDailyDigest, or sendWeeklyDigest instead
 */
export async function sendUpdateNotification(params: SendUpdateNotificationParams): Promise<EmailSendResult> {
  const { to, projectName, projectToken, projectColor, updates, isDigest = false } = params;
  const urls = generateUrls(projectToken, to);
  
  const emailData: NotificationEmailData = {
    projectName,
    projectColor,
    updates,
    timelineUrl: urls.timelineUrl,
    unsubscribeUrl: urls.unsubscribeUrl,
    isDigest,
  };

  return sendEmail({
    to,
    subject: generateLegacySubject(emailData),
    html: generateLegacyHtml(emailData),
    text: generateLegacyText(emailData),
  });
}

/**
 * Send notifications to multiple subscribers (batch)
 * Returns results for each recipient
 */
export async function sendBatchNotifications(
  subscribers: Array<{ email: string; subscriptionId: string }>,
  projectData: Omit<SendUpdateNotificationParams, 'to'>
): Promise<Map<string, EmailSendResult>> {
  const results = new Map<string, EmailSendResult>();
  
  // Process in parallel with concurrency limit
  const BATCH_SIZE = 5;
  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    
    const batchResults = await Promise.all(
      batch.map(async ({ email, subscriptionId }) => {
        const result = await sendUpdateNotification({
          ...projectData,
          to: email,
        });
        return { subscriptionId, result };
      })
    );
    
    for (const { subscriptionId, result } of batchResults) {
      results.set(subscriptionId, result);
    }
  }
  
  return results;
}

/**
 * Check if email service is configured and ready
 */
export function isEmailServiceReady(): boolean {
  return !!env.RESEND_API_KEY;
}
