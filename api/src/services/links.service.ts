import * as cheerio from 'cheerio';

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  domain: string;
}

export class LinkPreviewError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_URL' | 'FETCH_FAILED' | 'NO_METADATA'
  ) {
    super(message);
    this.name = 'LinkPreviewError';
  }
}

/**
 * Validates and normalizes a URL
 */
export function normalizeUrl(input: string): string {
  // Add protocol if missing
  let urlStr = input.trim();
  if (!urlStr.match(/^https?:\/\//i)) {
    urlStr = 'https://' + urlStr;
  }

  try {
    const url = new URL(urlStr);
    
    // Only allow http/https
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new LinkPreviewError('Invalid URL protocol', 'INVALID_URL');
    }

    return url.toString();
  } catch (error) {
    if (error instanceof LinkPreviewError) throw error;
    throw new LinkPreviewError('Invalid URL format', 'INVALID_URL');
  }
}

/**
 * Extracts domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Makes an absolute URL from a potentially relative URL
 */
function makeAbsoluteUrl(src: string | undefined | null, baseUrl: string): string | null {
  if (!src) return null;
  
  try {
    // Already absolute
    if (src.startsWith('http://') || src.startsWith('https://')) {
      return src;
    }
    
    // Protocol-relative
    if (src.startsWith('//')) {
      return 'https:' + src;
    }
    
    // Relative URL
    const base = new URL(baseUrl);
    return new URL(src, base).toString();
  } catch {
    return null;
  }
}

/**
 * Fetches and extracts metadata from a URL
 */
export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  // Normalize and validate URL
  const normalizedUrl = normalizeUrl(url);
  const domain = extractDomain(normalizedUrl);

  try {
    // Fetch the page with timeout and user agent
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SitRepBot/1.0; +https://statusping.app)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new LinkPreviewError(
        `Failed to fetch URL: ${response.status} ${response.statusText}`,
        'FETCH_FAILED'
      );
    }

    // Check content type
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new LinkPreviewError(
        'URL does not return HTML content',
        'NO_METADATA'
      );
    }

    // Read and parse HTML
    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract metadata with fallbacks
    // Title: og:title > twitter:title > <title>
    const title = 
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text().trim() ||
      null;

    // Description: og:description > twitter:description > meta description
    const description = 
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      null;

    // Image: og:image > twitter:image
    const imageRaw = 
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('meta[property="og:image:url"]').attr('content') ||
      null;

    const imageUrl = makeAbsoluteUrl(imageRaw, normalizedUrl);

    // Truncate description if too long
    const truncatedDescription = description 
      ? (description.length > 300 ? description.substring(0, 297) + '...' : description)
      : null;

    // Truncate title if too long
    const truncatedTitle = title
      ? (title.length > 200 ? title.substring(0, 197) + '...' : title)
      : null;

    return {
      url: normalizedUrl,
      title: truncatedTitle,
      description: truncatedDescription,
      imageUrl,
      domain,
    };
  } catch (error) {
    if (error instanceof LinkPreviewError) throw error;
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LinkPreviewError('Request timed out', 'FETCH_FAILED');
    }

    console.error('Link preview error:', error);
    throw new LinkPreviewError('Could not fetch URL metadata', 'FETCH_FAILED');
  }
}
