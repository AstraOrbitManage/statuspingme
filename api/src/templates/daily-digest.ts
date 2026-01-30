/**
 * Daily Digest Email Template
 * Sent once per day with all updates from the past 24 hours
 */

import type { UpdateWithMedia } from './instant-update';
import {
  wrapInBaseTemplate,
  generateTextFooter,
  createButton,
  ensureValidColor,
} from './base';

export interface DailyDigestEmailData {
  projectName: string;
  projectColor?: string;
  projectLogoUrl?: string;
  updates: UpdateWithMedia[];
  timelineUrl: string;
  unsubscribeUrl: string;
  managePreferencesUrl?: string;
}

/**
 * Format a date for display (short format for digest)
 */
function formatTime(date: Date | null): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/**
 * Truncate content for preview
 */
function truncate(text: string, maxLength = 150): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Get today's date formatted nicely
 */
function getFormattedDate(): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());
}

/**
 * Get media indicators for an update
 */
function getMediaIndicators(update: UpdateWithMedia): string[] {
  const indicators: string[] = [];
  if (update.images && update.images.length > 0) {
    indicators.push(`📷 ${update.images.length}`);
  }
  if (update.links && update.links.length > 0) {
    indicators.push(`🔗 ${update.links.length}`);
  }
  return indicators;
}

/**
 * Generate subject line
 */
export function generateDailySubject(data: DailyDigestEmailData): string {
  const count = data.updates.length;
  return `${count} new update${count !== 1 ? 's' : ''} today on ${data.projectName}`;
}

/**
 * Generate HTML email
 */
export function generateDailyHtml(data: DailyDigestEmailData): string {
  const { 
    projectName, 
    projectColor, 
    projectLogoUrl, 
    updates, 
    timelineUrl, 
    unsubscribeUrl,
    managePreferencesUrl 
  } = data;
  
  const brandColor = ensureValidColor(projectColor);
  const updateCount = updates.length;
  const today = getFormattedDate();
  
  // Build updates list
  const updatesHtml = updates.slice(0, 10).map((update, index) => {
    const timeStr = update.createdAt ? formatTime(new Date(update.createdAt)) : '';
    const preview = truncate(update.content);
    const indicators = getMediaIndicators(update);
    
    return `
      <tr>
        <td style="padding: 20px; ${index < updates.length - 1 ? 'border-bottom: 1px solid #e5e7eb;' : ''}">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="vertical-align: top; padding-right: 16px;">
                <!-- Time badge -->
                <div style="background: ${brandColor}15; color: ${brandColor}; font-size: 12px; font-weight: 600; padding: 4px 8px; border-radius: 4px; white-space: nowrap;">
                  ${timeStr}
                </div>
              </td>
              <td style="vertical-align: top; width: 100%;">
                <p style="margin: 0; color: #1f2937; font-size: 15px; line-height: 1.5;" class="text-primary">
                  ${escapeHtml(preview)}
                </p>
                ${indicators.length > 0 ? `
                <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 13px;">
                  ${indicators.join(' &nbsp; ')}
                </p>
                ` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }).join('');
  
  // If more than 10 updates, show count
  const moreUpdates = updates.length > 10 ? `
    <tr>
      <td style="padding: 16px; text-align: center; background: #f9fafb; border-radius: 0 0 8px 8px;">
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
          + ${updates.length - 10} more update${updates.length - 10 !== 1 ? 's' : ''}
        </p>
      </td>
    </tr>
  ` : '';

  const content = `
    <!-- Header info -->
    <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 15px;" class="text-secondary">
      Your daily digest for ${today}
    </p>
    
    <!-- Stats banner -->
    <div style="background: linear-gradient(135deg, ${brandColor}15, ${brandColor}05); border-radius: 12px; padding: 24px; margin: 20px 0; text-align: center;">
      <p style="margin: 0; font-size: 48px; font-weight: 700; color: ${brandColor};">
        ${updateCount}
      </p>
      <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 15px;">
        new update${updateCount !== 1 ? 's' : ''} today
      </p>
    </div>
    
    <!-- Updates list -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" 
           style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
      ${updatesHtml}
      ${moreUpdates}
    </table>
    
    <!-- CTA -->
    <div style="text-align: center; margin-top: 8px;">
      ${createButton('View All Updates', timelineUrl, brandColor)}
    </div>
  `;

  return wrapInBaseTemplate(content, {
    projectName,
    projectColor,
    projectLogoUrl,
    preheader: `${updateCount} new update${updateCount !== 1 ? 's' : ''} on ${projectName} today`,
    unsubscribeUrl,
    managePreferencesUrl,
  });
}

/**
 * Generate plain text email
 */
export function generateDailyText(data: DailyDigestEmailData): string {
  const { projectName, updates, timelineUrl, unsubscribeUrl, managePreferencesUrl } = data;
  const today = getFormattedDate();
  const count = updates.length;
  
  const updatesText = updates.slice(0, 10).map(update => {
    const timeStr = update.createdAt ? formatTime(new Date(update.createdAt)) : '';
    const preview = truncate(update.content, 200);
    const indicators = getMediaIndicators(update);
    
    return [
      `[${timeStr}]`,
      preview,
      indicators.length > 0 ? `(${indicators.join(', ')})` : '',
      '',
    ].filter(Boolean).join('\n');
  }).join('\n---\n\n');
  
  const moreText = updates.length > 10 
    ? `\n...and ${updates.length - 10} more update${updates.length - 10 !== 1 ? 's' : ''}\n` 
    : '';

  return `
${projectName} - Daily Digest
${today}
${'='.repeat(40)}

${count} new update${count !== 1 ? 's' : ''} today

${updatesText}${moreText}
View all updates: ${timelineUrl}

${generateTextFooter({ unsubscribeUrl, managePreferencesUrl })}
`.trim();
}
