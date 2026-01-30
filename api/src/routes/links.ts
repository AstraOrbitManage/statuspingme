import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { fetchLinkPreview, LinkPreviewError } from '../services/links.service.js';
import { validate, formatZodErrors } from '../utils/validation.js';

const router = Router();

// Validation schema for preview request
const previewSchema = z.object({
  url: z.string().min(1, 'URL is required').max(2000, 'URL too long'),
});

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/links/preview
 * Fetch metadata for a URL
 * 
 * Request: { url: string }
 * Response: { url, title, description, imageUrl, domain }
 */
router.post('/preview', async (req: Request, res: Response) => {
  try {
    // Validate request
    const validation = validate(previewSchema, req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: formatZodErrors(validation.errors),
      });
      return;
    }

    const { url } = validation.data;

    // Fetch link preview
    const preview = await fetchLinkPreview(url);

    res.json(preview);
  } catch (error) {
    if (error instanceof LinkPreviewError) {
      const statusCode = error.code === 'INVALID_URL' ? 400 : 422;
      res.status(statusCode).json({
        error: error.message,
        code: error.code,
      });
      return;
    }

    console.error('Link preview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
