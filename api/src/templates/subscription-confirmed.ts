/**
 * Subscription Confirmation Email Template
 * Sent when someone subscribes to project updates
 */

import {
  wrapInBaseTemplate,
  generateTextFooter,
  createButton,
  createSecondaryButton,
  ensureValidColor,
} from './base';

export type SubscriptionFrequency = 'instant' | 'daily' | 'weekly';

export interface SubscriptionConfirmedEmailData {
  projectName: string;
  projectColor?: string;
  projectLogoUrl?: string;
  frequency: SubscriptionFrequency;
  timelineUrl: string;
  managePreferencesUrl: string;
  unsubscribeUrl: string;
}

/**
 * Get human-readable frequency description
 */
function getFrequencyDescription(frequency: SubscriptionFrequency): {
  title: string;
  description: string;
  emoji: string;
} {
  switch (frequency) {
    case 'instant':
      return {
        title: 'Instant notifications',
        description: "You'll receive an email immediately whenever a new update is posted.",
        emoji: '⚡',
      };
    case 'daily':
      return {
        title: 'Daily digest',
        description: "You'll receive a daily summary email with all updates from the day.",
        emoji: '📅',
      };
    case 'weekly':
      return {
        title: 'Weekly digest',
        description: "You'll receive a weekly summary email every week with all updates.",
        emoji: '📆',
      };
  }
}

/**
 * Generate subject line
 */
export function generateConfirmationSubject(data: SubscriptionConfirmedEmailData): string {
  return `You're subscribed to ${data.projectName} updates`;
}

/**
 * Generate HTML email
 */
export function generateConfirmationHtml(data: SubscriptionConfirmedEmailData): string {
  const { 
    projectName, 
    projectColor, 
    projectLogoUrl, 
    frequency,
    timelineUrl, 
    managePreferencesUrl,
    unsubscribeUrl,
  } = data;
  
  const brandColor = ensureValidColor(projectColor);
  const freqInfo = getFrequencyDescription(frequency);

  const content = `
    <!-- Success checkmark -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 80px; height: 80px; background: ${brandColor}15; border-radius: 50%; line-height: 80px; font-size: 40px;">
        ✓
      </div>
    </div>
    
    <!-- Welcome message -->
    <div style="text-align: center; margin-bottom: 32px;">
      <h2 style="margin: 0 0 8px 0; color: #1f2937; font-size: 20px; font-weight: 600;" class="text-primary">
        You're all set!
      </h2>
      <p style="margin: 0; color: #6b7280; font-size: 15px;" class="text-secondary">
        You've successfully subscribed to updates from <strong>${projectName}</strong>
      </p>
    </div>
    
    <!-- Frequency info card -->
    <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;" class="content-bg">
      <p style="margin: 0 0 4px 0; font-size: 32px;">${freqInfo.emoji}</p>
      <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 16px; font-weight: 600;" class="text-primary">
        ${freqInfo.title}
      </h3>
      <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.5;" class="text-secondary">
        ${freqInfo.description}
      </p>
    </div>
    
    <!-- What to expect -->
    <div style="margin-bottom: 32px;">
      <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 15px; font-weight: 600;" class="text-primary">
        What to expect
      </h3>
      
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="width: 32px; vertical-align: top;">
                  <span style="font-size: 18px;">📝</span>
                </td>
                <td style="vertical-align: top;">
                  <p style="margin: 0; color: #1f2937; font-size: 14px; font-weight: 500;" class="text-primary">
                    Project updates
                  </p>
                  <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;" class="text-secondary">
                    Progress reports, milestones, and important news
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="width: 32px; vertical-align: top;">
                  <span style="font-size: 18px;">📷</span>
                </td>
                <td style="vertical-align: top;">
                  <p style="margin: 0; color: #1f2937; font-size: 14px; font-weight: 500;" class="text-primary">
                    Images & media
                  </p>
                  <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;" class="text-secondary">
                    Screenshots, photos, and visual updates
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="width: 32px; vertical-align: top;">
                  <span style="font-size: 18px;">🔗</span>
                </td>
                <td style="vertical-align: top;">
                  <p style="margin: 0; color: #1f2937; font-size: 14px; font-weight: 500;" class="text-primary">
                    Useful links
                  </p>
                  <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;" class="text-secondary">
                    Resources, demos, and relevant references
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
    
    <!-- CTAs -->
    <div style="text-align: center;">
      ${createButton('View Project Timeline', timelineUrl, brandColor)}
      ${createSecondaryButton('Manage Preferences', managePreferencesUrl, brandColor)}
    </div>
    
    <!-- Help text -->
    <p style="margin: 32px 0 0 0; color: #9ca3af; font-size: 13px; text-align: center;" class="text-muted">
      Want to change how often you receive updates?<br>
      You can adjust your preferences anytime.
    </p>
  `;

  return wrapInBaseTemplate(content, {
    projectName,
    projectColor,
    projectLogoUrl,
    preheader: `You're now subscribed to ${projectName} updates`,
    unsubscribeUrl,
    managePreferencesUrl,
  });
}

/**
 * Generate plain text email
 */
export function generateConfirmationText(data: SubscriptionConfirmedEmailData): string {
  const { 
    projectName, 
    frequency,
    timelineUrl, 
    managePreferencesUrl,
    unsubscribeUrl,
  } = data;
  
  const freqInfo = getFrequencyDescription(frequency);

  return `
You're subscribed to ${projectName} updates!
${'='.repeat(40)}

✓ Subscription confirmed

${freqInfo.emoji} ${freqInfo.title}
${freqInfo.description}

WHAT TO EXPECT
--------------
📝 Project updates - Progress reports, milestones, and important news
📷 Images & media - Screenshots, photos, and visual updates
🔗 Useful links - Resources, demos, and relevant references

View project timeline: ${timelineUrl}

${generateTextFooter({ unsubscribeUrl, managePreferencesUrl })}
`.trim();
}
