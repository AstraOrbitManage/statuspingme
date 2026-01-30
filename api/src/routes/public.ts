import { Router, Request, Response } from 'express';
import { eq, desc, count, and } from 'drizzle-orm';
import { db, projects, updates, images, links, digestSubscriptions } from '../db/index.js';
import { sendSubscriptionConfirmed, type SubscriptionFrequency } from '../services/email.service.js';

const router = Router();

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

interface PublicLink {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  domain: string;
}

interface PublicUpdate {
  id: string;
  projectId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  images: Array<{
    id: string;
    url: string;
    filename: string | null;
  }>;
  link: PublicLink | null;
}

interface PublicTimelineResponse {
  project: {
    id: string;
    name: string;
    clientName: string | null;
    status: string;
    brandingLogoUrl: string | null;
    brandingColor: string | null;
  };
  updates: PublicUpdate[];
  total: number;
  hasMore: boolean;
}

/**
 * GET /api/public/timeline/:token
 * Public endpoint - no authentication required
 * Returns project info + updates for valid magic link token
 */
router.get('/timeline/:token', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    // Look up project by magic link token
    const project = await db.query.projects.findFirst({
      where: eq(projects.magicLinkToken, token),
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Get updates for this project with pagination (newest first)
    const updatesList = await db
      .select()
      .from(updates)
      .where(eq(updates.projectId, project.id))
      .orderBy(desc(updates.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count: totalCount }] = await db
      .select({ count: count() })
      .from(updates)
      .where(eq(updates.projectId, project.id));

    const total = Number(totalCount);

    // Get attachments for each update
    const updatesWithAttachments: PublicUpdate[] = [];

    for (const update of updatesList) {
      // Get images
      const updateImages = await db
        .select({
          id: images.id,
          url: images.url,
          filename: images.filename,
        })
        .from(images)
        .where(eq(images.updateId, update.id));

      // Get link (max 1)
      const updateLinks = await db
        .select({
          id: links.id,
          url: links.url,
          title: links.title,
          description: links.description,
          imageUrl: links.imageUrl,
        })
        .from(links)
        .where(eq(links.updateId, update.id))
        .limit(1);

      const createdAt = update.createdAt ?? new Date();

      // Build link with domain if present
      let publicLink: PublicLink | null = null;
      if (updateLinks[0]) {
        publicLink = {
          ...updateLinks[0],
          domain: extractDomain(updateLinks[0].url),
        };
      }

      updatesWithAttachments.push({
        id: update.id,
        projectId: update.projectId,
        content: update.content,
        createdAt,
        updatedAt: createdAt,
        images: updateImages,
        link: publicLink,
      });
    }

    const response: PublicTimelineResponse = {
      project: {
        id: project.id,
        name: project.name,
        clientName: project.clientName ?? null,
        status: project.status ?? 'active',
        brandingLogoUrl: project.brandingLogoUrl ?? null,
        brandingColor: project.brandingColor ?? null,
      },
      updates: updatesWithAttachments,
      total,
      hasMore: offset + limit < total,
    };

    res.json(response);
  } catch (error) {
    console.error('Public timeline error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/public/timeline/:token/subscribe
 * Public endpoint - subscribes an email to project updates
 */
router.post('/timeline/:token/subscribe', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { email, frequency } = req.body;

    // Validate email
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    // Validate frequency
    const validFrequencies = ['instant', 'daily', 'weekly'];
    const normalizedFrequency = frequency && validFrequencies.includes(frequency) 
      ? frequency 
      : 'instant';

    // Look up project by magic link token
    const project = await db.query.projects.findFirst({
      where: eq(projects.magicLinkToken, token),
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Check if already subscribed
    const existingSubscription = await db.query.digestSubscriptions.findFirst({
      where: and(
        eq(digestSubscriptions.projectId, project.id),
        eq(digestSubscriptions.email, email.toLowerCase().trim())
      ),
    });

    if (existingSubscription) {
      // Update existing subscription frequency
      await db
        .update(digestSubscriptions)
        .set({ frequency: normalizedFrequency })
        .where(eq(digestSubscriptions.id, existingSubscription.id));
      
      // Send confirmation for updated subscription (fire and forget)
      sendSubscriptionConfirmed({
        to: email.toLowerCase().trim(),
        projectName: project.name,
        projectToken: project.magicLinkToken,
        projectColor: project.brandingColor || undefined,
        projectLogoUrl: project.brandingLogoUrl || undefined,
        frequency: normalizedFrequency as SubscriptionFrequency,
      }).catch(err => {
        console.error('[Public] Failed to send subscription update confirmation:', err);
      });
      
      res.json({ message: 'Subscription updated successfully' });
      return;
    }

    // Create new subscription
    await db.insert(digestSubscriptions).values({
      projectId: project.id,
      email: email.toLowerCase().trim(),
      frequency: normalizedFrequency,
    });

    // Send subscription confirmation email (fire and forget)
    sendSubscriptionConfirmed({
      to: email.toLowerCase().trim(),
      projectName: project.name,
      projectToken: project.magicLinkToken,
      projectColor: project.brandingColor || undefined,
      projectLogoUrl: project.brandingLogoUrl || undefined,
      frequency: normalizedFrequency as SubscriptionFrequency,
    }).catch(err => {
      console.error('[Public] Failed to send subscription confirmation:', err);
    });

    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/public/timeline/:token/unsubscribe
 * Public endpoint - unsubscribes an email from project updates
 */
router.delete('/timeline/:token/unsubscribe', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const email = (req.query.email as string) || req.body?.email;

    // Validate email
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    // Look up project by magic link token
    const project = await db.query.projects.findFirst({
      where: eq(projects.magicLinkToken, token),
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Find and delete subscription
    const existingSubscription = await db.query.digestSubscriptions.findFirst({
      where: and(
        eq(digestSubscriptions.projectId, project.id),
        eq(digestSubscriptions.email, email.toLowerCase().trim())
      ),
    });

    if (!existingSubscription) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    await db
      .delete(digestSubscriptions)
      .where(eq(digestSubscriptions.id, existingSubscription.id));

    res.json({ message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/public/timeline/:token/subscription-status
 * Public endpoint - checks if an email is subscribed
 */
router.get('/timeline/:token/subscription-status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const email = req.query.email as string;

    if (!email) {
      res.status(400).json({ error: 'Email query parameter is required' });
      return;
    }

    // Look up project by magic link token
    const project = await db.query.projects.findFirst({
      where: eq(projects.magicLinkToken, token),
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Find subscription
    const subscription = await db.query.digestSubscriptions.findFirst({
      where: and(
        eq(digestSubscriptions.projectId, project.id),
        eq(digestSubscriptions.email, email.toLowerCase().trim())
      ),
    });

    if (!subscription) {
      res.json({ subscribed: false });
      return;
    }

    res.json({
      subscribed: true,
      frequency: subscription.frequency,
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
