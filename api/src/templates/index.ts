/**
 * Email Templates
 * 
 * Polished, branded email templates for SitRep notifications.
 * All templates support:
 * - Project branding (colors, logo)
 * - Mobile-responsive HTML
 * - Plain text fallbacks
 * - Dark mode support
 */

// Base template utilities
export {
  wrapInBaseTemplate,
  generateTextFooter,
  createButton,
  createSecondaryButton,
  ensureValidColor,
  getLightBackground,
  DEFAULT_BRAND_COLOR,
  type BaseTemplateOptions,
} from './base';

// Instant update template (single update notification)
export {
  generateInstantSubject,
  generateInstantHtml,
  generateInstantText,
  type InstantUpdateEmailData,
  type UpdateWithMedia,
} from './instant-update';

// Daily digest template
export {
  generateDailySubject,
  generateDailyHtml,
  generateDailyText,
  type DailyDigestEmailData,
} from './daily-digest';

// Weekly digest template
export {
  generateWeeklySubject,
  generateWeeklyHtml,
  generateWeeklyText,
  type WeeklyDigestEmailData,
} from './weekly-digest';

// Subscription confirmation template
export {
  generateConfirmationSubject,
  generateConfirmationHtml,
  generateConfirmationText,
  type SubscriptionConfirmedEmailData,
  type SubscriptionFrequency,
} from './subscription-confirmed';

/**
 * Template generation helper
 * Maps template types to their generators for easy dispatch
 */
export type TemplateType = 'instant' | 'daily' | 'weekly' | 'confirmation';

export interface GeneratedEmail {
  subject: string;
  html: string;
  text: string;
}

// Re-export the old interface for backward compatibility
export { 
  type NotificationEmailData,
  generateSubject,
  generateHtml,
  generateText,
} from './update-notification';
