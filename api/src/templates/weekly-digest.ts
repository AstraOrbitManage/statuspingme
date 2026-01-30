/**
 * Weekly Digest Email Template
 * Sent once per week with a summary of all updates
 */

import type { UpdateWithMedia } from './instant-update';
import {
  wrapInBaseTemplate,
  generateTextFooter,
  createButton,
  createSecondaryButton,
  ensureValidColor,
} from './base';

export interface WeeklyDigestEmailData {
  projectName: string;
  projectColor?: string;
  projectLogoUrl?: string;
  updates: UpdateWithMedia[];
  timelineUrl: string;
  unsubscribeUrl: string;
  managePreferencesUrl?: string;
  weekStartDate: Date;
  weekEndDate: Date;
}

/**
 * Format date range for display
 */
function formatDateRange(start: Date, end: Date): string {
  const startStr = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(start);
  
  const endStr = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(end);
  
  return `${startStr} - ${endStr}`;
}

/**
 * Format a date for display
 */
function formatDay(date: Date | null): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * Truncate content for preview
 */
function truncate(text: string, maxLength = 120): string {
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
 * Group updates by day
 */
function groupByDay(updates: UpdateWithMedia[]): Map<string, UpdateWithMedia[]> {
  const groups = new Map<string, UpdateWithMedia[]>();
  
  for (const update of updates) {
    if (!update.createdAt) continue;
    
    const date = new Date(update.createdAt);
    const key = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const list = groups.get(key) || [];
    list.push(update);
    groups.set(key, list);
  }
  
  return groups;
}

/**
 * Count total media across updates
 */
function countMedia(updates: UpdateWithMedia[]): { images: number; links: number } {
  return updates.reduce(
    (acc, update) => ({
      images: acc.images + (update.images?.length || 0),
      links: acc.links + (update.links?.length || 0),
    }),
    { images: 0, links: 0 }
  );
}

/**
 * Generate subject line
 */
export function generateWeeklySubject(data: WeeklyDigestEmailData): string {
  const dateRange = formatDateRange(data.weekStartDate, data.weekEndDate);
  return `Your weekly summary for ${data.projectName} (${dateRange})`;
}

/**
 * Generate HTML email
 */
export function generateWeeklyHtml(data: WeeklyDigestEmailData): string {
  const { 
    projectName, 
    projectColor, 
    projectLogoUrl, 
    updates, 
    timelineUrl, 
    unsubscribeUrl,
    managePreferencesUrl,
    weekStartDate,
    weekEndDate,
  } = data;
  
  const brandColor = ensureValidColor(projectColor);
  const updateCount = updates.length;
  const dateRange = formatDateRange(weekStartDate, weekEndDate);
  const media = countMedia(updates);
  const groupedUpdates = groupByDay(updates);
  const activeDays = groupedUpdates.size;
  
  // Build stats
  const stats = [
    { value: updateCount, label: `update${updateCount !== 1 ? 's' : ''}` },
    { value: activeDays, label: `day${activeDays !== 1 ? 's' : ''} with activity` },
  ];
  if (media.images > 0) {
    stats.push({ value: media.images, label: `image${media.images !== 1 ? 's' : ''}` });
  }
  if (media.links > 0) {
    stats.push({ value: media.links, label: `link${media.links !== 1 ? 's' : ''}` });
  }
  
  const statsHtml = stats.map(stat => `
    <td style="text-align: center; padding: 16px;">
      <p style="margin: 0; font-size: 32px; font-weight: 700; color: ${brandColor};">${stat.value}</p>
      <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">${stat.label}</p>
    </td>
  `).join('');
  
  // Build highlights (latest 5 updates)
  const highlights = updates.slice(0, 5);
  const highlightsHtml = highlights.map((update, index) => {
    const dayStr = update.createdAt ? formatDay(new Date(update.createdAt)) : '';
    const preview = truncate(update.content);
    
    return `
      <tr>
        <td style="padding: 16px; ${index < highlights.length - 1 ? 'border-bottom: 1px solid #e5e7eb;' : ''}">
          <p style="margin: 0 0 4px 0; color: #9ca3af; font-size: 12px; font-weight: 500;" class="text-muted">
            ${dayStr}
          </p>
          <p style="margin: 0; color: #1f2937; font-size: 14px; line-height: 1.5;" class="text-primary">
            ${escapeHtml(preview)}
          </p>
        </td>
      </tr>
    `;
  }).join('');
  
  // "More updates" indicator
  const moreUpdatesHtml = updates.length > 5 ? `
    <tr>
      <td style="padding: 16px; background: #f9fafb; text-align: center; border-radius: 0 0 8px 8px;">
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
          + ${updates.length - 5} more update${updates.length - 5 !== 1 ? 's' : ''} this week
        </p>
      </td>
    </tr>
  ` : '';

  const content = `
    <!-- Header info -->
    <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 15px;" class="text-secondary">
      Here's what happened this week (${dateRange})
    </p>
    
    <!-- Stats grid -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" 
           style="background: linear-gradient(135deg, ${brandColor}10, ${brandColor}05); border-radius: 12px; margin-bottom: 24px;">
      <tr>
        ${statsHtml}
      </tr>
    </table>
    
    <!-- Highlights section -->
    <div style="margin-bottom: 24px;">
      <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 16px; font-weight: 600;" class="text-primary">
        📌 Highlights
      </h2>
      
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" 
             style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        ${highlightsHtml}
        ${moreUpdatesHtml}
      </table>
    </div>
    
    <!-- Activity by day (mini calendar view) -->
    <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;" class="content-bg">
      <h3 style="margin: 0 0 16px 0; color: #6b7280; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
        Activity This Week
      </h3>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
            // Calculate the date for this day of the week
            const date = new Date(weekStartDate);
            date.setDate(date.getDate() + i);
            const dateKey = date.toISOString().split('T')[0];
            const dayUpdates = groupedUpdates.get(dateKey) || [];
            const hasActivity = dayUpdates.length > 0;
            
            return `
              <td style="text-align: center; padding: 8px;">
                <p style="margin: 0 0 4px 0; color: #9ca3af; font-size: 11px;">${day}</p>
                <div style="width: 32px; height: 32px; border-radius: 50%; background: ${hasActivity ? brandColor : '#e5e7eb'}; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
                  ${hasActivity ? `<span style="color: white; font-size: 12px; font-weight: 600;">${dayUpdates.length}</span>` : ''}
                </div>
              </td>
            `;
          }).join('')}
        </tr>
      </table>
    </div>
    
    <!-- CTA -->
    <div style="text-align: center;">
      ${createButton('Catch Up on Everything', timelineUrl, brandColor)}
    </div>
  `;

  return wrapInBaseTemplate(content, {
    projectName,
    projectColor,
    projectLogoUrl,
    preheader: `${updateCount} updates this week on ${projectName}`,
    unsubscribeUrl,
    managePreferencesUrl,
  });
}

/**
 * Generate plain text email
 */
export function generateWeeklyText(data: WeeklyDigestEmailData): string {
  const { 
    projectName, 
    updates, 
    timelineUrl, 
    unsubscribeUrl, 
    managePreferencesUrl,
    weekStartDate,
    weekEndDate,
  } = data;
  
  const dateRange = formatDateRange(weekStartDate, weekEndDate);
  const media = countMedia(updates);
  const groupedUpdates = groupByDay(updates);
  
  // Stats
  const statsText = [
    `📊 ${updates.length} update${updates.length !== 1 ? 's' : ''}`,
    `📅 ${groupedUpdates.size} day${groupedUpdates.size !== 1 ? 's' : ''} with activity`,
    media.images > 0 ? `📷 ${media.images} image${media.images !== 1 ? 's' : ''}` : '',
    media.links > 0 ? `🔗 ${media.links} link${media.links !== 1 ? 's' : ''}` : '',
  ].filter(Boolean).join(' | ');
  
  // Highlights
  const highlights = updates.slice(0, 5).map(update => {
    const dayStr = update.createdAt ? formatDay(new Date(update.createdAt)) : '';
    const preview = truncate(update.content, 150);
    return `[${dayStr}]\n${preview}`;
  }).join('\n\n---\n\n');
  
  const moreText = updates.length > 5 
    ? `\n\n...and ${updates.length - 5} more update${updates.length - 5 !== 1 ? 's' : ''}\n` 
    : '';

  return `
${projectName} - Weekly Summary
${dateRange}
${'='.repeat(40)}

${statsText}

HIGHLIGHTS
----------

${highlights}${moreText}

Catch up on everything: ${timelineUrl}

${generateTextFooter({ unsubscribeUrl, managePreferencesUrl })}
`.trim();
}
