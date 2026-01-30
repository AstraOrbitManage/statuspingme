import type { Update } from '../db/schema/updates';
import type { Image } from '../db/schema/images';
import type { Link } from '../db/schema/links';

export interface UpdateWithMedia extends Update {
  images?: Image[];
  links?: Link[];
}

export interface NotificationEmailData {
  projectName: string;
  projectColor?: string;
  updates: UpdateWithMedia[];
  timelineUrl: string;
  unsubscribeUrl: string;
  isDigest: boolean; // true for daily/weekly, false for instant
}

function truncateContent(content: string, maxLength = 200): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength).trim() + '...';
}

function formatDate(date: Date | null): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getMediaIndicators(update: UpdateWithMedia): string[] {
  const indicators: string[] = [];
  if (update.images && update.images.length > 0) {
    indicators.push(`📷 ${update.images.length} image${update.images.length > 1 ? 's' : ''}`);
  }
  if (update.links && update.links.length > 0) {
    indicators.push(`🔗 ${update.links.length} link${update.links.length > 1 ? 's' : ''}`);
  }
  return indicators;
}

export function generateSubject(data: NotificationEmailData): string {
  if (data.isDigest) {
    const count = data.updates.length;
    return `${count} new update${count > 1 ? 's' : ''} on ${data.projectName}`;
  }
  return `New update on ${data.projectName}`;
}

export function generateHtml(data: NotificationEmailData): string {
  const { projectName, projectColor = '#6366f1', updates, timelineUrl, unsubscribeUrl, isDigest } = data;
  
  const updatesHtml = updates.map(update => {
    const preview = truncateContent(update.content);
    const indicators = getMediaIndicators(update);
    const dateStr = update.createdAt ? formatDate(new Date(update.createdAt)) : '';
    
    return `
      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        ${dateStr ? `<p style="color: #6b7280; font-size: 12px; margin: 0 0 8px 0;">${dateStr}</p>` : ''}
        <p style="color: #1f2937; margin: 0; line-height: 1.6; white-space: pre-wrap;">${preview}</p>
        ${indicators.length > 0 ? `
          <p style="color: #6b7280; font-size: 13px; margin: 12px 0 0 0;">
            ${indicators.join(' &nbsp;•&nbsp; ')}
          </p>
        ` : ''}
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${generateSubject(data)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="background: white; border-radius: 12px 12px 0 0; padding: 32px; border-bottom: 4px solid ${projectColor};">
      <h1 style="margin: 0; color: #1f2937; font-size: 24px; font-weight: 600;">
        ${projectName}
      </h1>
      <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 15px;">
        ${isDigest 
          ? `You have ${updates.length} new update${updates.length > 1 ? 's' : ''}`
          : 'New update posted'
        }
      </p>
    </div>
    
    <!-- Content -->
    <div style="background: white; padding: 32px;">
      ${updatesHtml}
      
      <!-- CTA Button -->
      <div style="text-align: center; margin-top: 24px;">
        <a href="${timelineUrl}" 
           style="display: inline-block; background: ${projectColor}; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 500; font-size: 15px;">
          View ${isDigest ? 'All Updates' : 'Update'}
        </a>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background: #f9fafb; border-radius: 0 0 12px 12px; padding: 24px 32px; text-align: center;">
      <p style="margin: 0; color: #9ca3af; font-size: 13px;">
        You're receiving this because you subscribed to updates.
      </p>
      <p style="margin: 8px 0 0 0;">
        <a href="${unsubscribeUrl}" style="color: #6b7280; font-size: 13px;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function generateText(data: NotificationEmailData): string {
  const { projectName, updates, timelineUrl, unsubscribeUrl, isDigest } = data;
  
  const header = isDigest 
    ? `${projectName} - ${updates.length} new update${updates.length > 1 ? 's' : ''}`
    : `${projectName} - New update`;
  
  const updatesText = updates.map(update => {
    const preview = truncateContent(update.content);
    const indicators = getMediaIndicators(update);
    const dateStr = update.createdAt ? formatDate(new Date(update.createdAt)) : '';
    
    return [
      '---',
      dateStr ? `${dateStr}` : '',
      preview,
      indicators.length > 0 ? indicators.join(' | ') : '',
      '---',
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  return `
${header}

${updatesText}

View ${isDigest ? 'all updates' : 'the update'}: ${timelineUrl}

---
You're receiving this because you subscribed to updates.
Unsubscribe: ${unsubscribeUrl}
  `.trim();
}
