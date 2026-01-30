/**
 * Base email template with shared HTML wrapper
 * Provides consistent branding, header, footer across all emails
 */

export interface BaseTemplateOptions {
  projectName: string;
  projectColor?: string;
  projectLogoUrl?: string;
  preheader?: string;
  unsubscribeUrl?: string;
  managePreferencesUrl?: string;
}

/**
 * Default brand color when none specified
 */
export const DEFAULT_BRAND_COLOR = '#6366f1';

/**
 * Ensure color has proper contrast for text on white
 */
export function ensureValidColor(color?: string): string {
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return DEFAULT_BRAND_COLOR;
  }
  return color;
}

/**
 * Get a lighter version of a color for backgrounds
 */
export function getLightBackground(hexColor: string): string {
  // Return a very light tinted background
  return `${hexColor}10`; // 10% opacity via hex
}

/**
 * Wrap content in the base HTML email template
 */
export function wrapInBaseTemplate(
  content: string,
  options: BaseTemplateOptions
): string {
  const {
    projectName,
    projectColor,
    projectLogoUrl,
    preheader = '',
    unsubscribeUrl,
    managePreferencesUrl,
  } = options;

  const brandColor = ensureValidColor(projectColor);
  
  const logoHtml = projectLogoUrl
    ? `<img src="${projectLogoUrl}" alt="${projectName}" style="max-height: 48px; max-width: 200px; margin-bottom: 16px;" />`
    : '';

  const footerLinks: string[] = [];
  if (managePreferencesUrl) {
    footerLinks.push(`<a href="${managePreferencesUrl}" style="color: #6b7280; text-decoration: underline;">Manage preferences</a>`);
  }
  if (unsubscribeUrl) {
    footerLinks.push(`<a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a>`);
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>${projectName}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset styles */
    body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
    
    /* Dark mode styles */
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #1f2937 !important; }
      .card-bg { background-color: #374151 !important; }
      .content-bg { background-color: #4b5563 !important; }
      .text-primary { color: #f9fafb !important; }
      .text-secondary { color: #d1d5db !important; }
      .text-muted { color: #9ca3af !important; }
    }
    
    /* Mobile styles */
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .mobile-padding { padding-left: 16px !important; padding-right: 16px !important; }
      .mobile-stack { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  
  <!-- Preheader text (hidden preview text) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    ${preheader}
    ${'&nbsp;'.repeat(100)}
  </div>
  
  <!-- Email wrapper -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-bg" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Email container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="max-width: 600px; width: 100%;">
          
          <!-- Header with brand bar -->
          <tr>
            <td style="background-color: white; border-radius: 12px 12px 0 0; padding: 32px; border-bottom: 4px solid ${brandColor};" class="card-bg mobile-padding">
              ${logoHtml}
              <h1 style="margin: 0; color: #1f2937; font-size: 24px; font-weight: 600;" class="text-primary">
                ${projectName}
              </h1>
            </td>
          </tr>
          
          <!-- Main content -->
          <tr>
            <td style="background-color: white; padding: 32px;" class="card-bg mobile-padding">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; border-radius: 0 0 12px 12px; padding: 24px 32px; text-align: center;" class="content-bg mobile-padding">
              ${footerLinks.length > 0 ? `
              <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 13px;" class="text-muted">
                ${footerLinks.join(' &nbsp;•&nbsp; ')}
              </p>
              ` : ''}
              <p style="margin: 0; color: #9ca3af; font-size: 12px;" class="text-muted">
                Powered by <a href="https://statuspingapp.com" style="color: #9ca3af; text-decoration: none;">StatusPing</a>
              </p>
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>
`.trim();
}

/**
 * Generate base plain text footer
 */
export function generateTextFooter(options: {
  unsubscribeUrl?: string;
  managePreferencesUrl?: string;
}): string {
  const lines: string[] = ['---'];
  
  if (options.managePreferencesUrl) {
    lines.push(`Manage preferences: ${options.managePreferencesUrl}`);
  }
  if (options.unsubscribeUrl) {
    lines.push(`Unsubscribe: ${options.unsubscribeUrl}`);
  }
  
  lines.push('Powered by StatusPing - https://statuspingapp.com');
  
  return lines.join('\n');
}

/**
 * Create a CTA button HTML
 */
export function createButton(
  text: string,
  url: string,
  color: string = DEFAULT_BRAND_COLOR
): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 24px auto 0 auto;">
      <tr>
        <td style="border-radius: 8px; background-color: ${color};">
          <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 500; color: #ffffff; text-decoration: none; border-radius: 8px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Create a secondary/ghost button HTML
 */
export function createSecondaryButton(
  text: string,
  url: string,
  color: string = DEFAULT_BRAND_COLOR
): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 16px auto 0 auto;">
      <tr>
        <td style="border-radius: 8px; border: 2px solid ${color};">
          <a href="${url}" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 14px; font-weight: 500; color: ${color}; text-decoration: none; border-radius: 6px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `;
}
