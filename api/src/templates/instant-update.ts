/**
 * Instant Update Email Template
 * Sent immediately when a new update is posted
 */

import type { Update } from '../db/schema/updates';
import type { Image } from '../db/schema/images';
import type { Link } from '../db/schema/links';
import {
  wrapInBaseTemplate,
  generateTextFooter,
  createButton,
  ensureValidColor,
  DEFAULT_BRAND_COLOR,
} from './base';

export interface UpdateWithMedia extends Update {
  images?: Image[];
  links?: Link[];
}

export interface InstantUpdateEmailData {
  projectName: string;
  projectColor?: string;
  projectLogoUrl?: string;
  update: UpdateWithMedia;
  timelineUrl: string;
  unsubscribeUrl: string;
}

/**
 * Format a date for display
 */
function formatDate(date: Date | null): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Convert newlines to HTML breaks
 */
function nl2br(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

/**
 * Generate subject line
 */
export function generateInstantSubject(data: InstantUpdateEmailData): string {
  return `New update on ${data.projectName}`;
}

/**
 * Generate HTML email
 */
export function generateInstantHtml(data: InstantUpdateEmailData): string {
  const { projectName, projectColor, projectLogoUrl, update, timelineUrl, unsubscribeUrl } = data;
  const brandColor = ensureValidColor(projectColor);
  const dateStr = update.createdAt ? formatDate(new Date(update.createdAt)) : '';
  
  // Build media section
  let mediaHtml = '';
  
  // Images
  if (update.images && update.images.length > 0) {
    const imageCount = update.images.length;
    const previewImage = update.images[0];
    
    mediaHtml += `
      <div style="margin-top: 20px; border-radius: 8px; overflow: hidden; background: #f3f4f6;">
        ${previewImage.url ? `
        <a href="${timelineUrl}" style="display: block;">
          <img src="${previewImage.url}" alt="${escapeHtml(previewImage.filename || 'Image')}" 
               style="width: 100%; max-height: 300px; object-fit: cover; display: block;" />
        </a>
        ` : ''}
        ${imageCount > 1 ? `
        <p style="margin: 0; padding: 12px; color: #6b7280; font-size: 13px; text-align: center;">
          📷 ${imageCount} images attached
        </p>
        ` : ''}
      </div>
    `;
  }
  
  // Links
  if (update.links && update.links.length > 0) {
    const linksHtml = update.links.slice(0, 3).map(link => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <a href="${link.url}" style="color: ${brandColor}; text-decoration: none; font-weight: 500;">
            ${escapeHtml(link.title || link.url)}
          </a>
          ${link.description ? `
          <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">
            ${escapeHtml(link.description).substring(0, 100)}${link.description.length > 100 ? '...' : ''}
          </p>
          ` : ''}
        </td>
      </tr>
    `).join('');
    
    const moreLinks = update.links.length > 3 ? `
      <tr>
        <td style="padding: 12px; color: #6b7280; font-size: 13px;">
          + ${update.links.length - 3} more link${update.links.length - 3 > 1 ? 's' : ''}
        </td>
      </tr>
    ` : '';
    
    mediaHtml += `
      <div style="margin-top: 20px;">
        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
          🔗 Links
        </p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" 
               style="background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
          ${linksHtml}
          ${moreLinks}
        </table>
      </div>
    `;
  }

  const content = `
    <!-- Subtitle -->
    <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 15px;" class="text-secondary">
      A new update was just posted
    </p>
    
    <!-- Update card -->
    <div style="background: #f9fafb; border-radius: 12px; padding: 24px; border-left: 4px solid ${brandColor};" class="content-bg">
      ${dateStr ? `
      <p style="margin: 0 0 12px 0; color: #9ca3af; font-size: 13px;" class="text-muted">
        ${dateStr}
      </p>
      ` : ''}
      
      <div style="color: #1f2937; font-size: 15px; line-height: 1.7;" class="text-primary">
        ${nl2br(update.content)}
      </div>
      
      ${mediaHtml}
    </div>
    
    <!-- CTA -->
    <div style="text-align: center;">
      ${createButton('View on Timeline', timelineUrl, brandColor)}
    </div>
  `;

  return wrapInBaseTemplate(content, {
    projectName,
    projectColor,
    projectLogoUrl,
    preheader: update.content.substring(0, 100),
    unsubscribeUrl,
  });
}

/**
 * Generate plain text email
 */
export function generateInstantText(data: InstantUpdateEmailData): string {
  const { projectName, update, timelineUrl, unsubscribeUrl } = data;
  const dateStr = update.createdAt ? formatDate(new Date(update.createdAt)) : '';
  
  let mediaText = '';
  
  if (update.images && update.images.length > 0) {
    mediaText += `\n\n📷 ${update.images.length} image${update.images.length > 1 ? 's' : ''} attached`;
  }
  
  if (update.links && update.links.length > 0) {
    mediaText += '\n\n🔗 Links:\n' + update.links.map(link => 
      `  - ${link.title || link.url}: ${link.url}`
    ).join('\n');
  }

  return `
${projectName} - New Update
${'='.repeat(40)}

${dateStr ? `Posted: ${dateStr}\n\n` : ''}${update.content}${mediaText}

View on timeline: ${timelineUrl}

${generateTextFooter({ unsubscribeUrl })}
`.trim();
}
