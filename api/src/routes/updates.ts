import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  createUpdate,
  listUpdates,
  getUpdate,
  updateUpdate,
  deleteUpdate,
  UpdateError,
} from '../services/updates.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, formatZodErrors } from '../utils/validation.js';

const router = Router({ mergeParams: true });

// Validation schemas
const imageInputSchema = z.object({
  url: z.string().url('Invalid image URL').max(500, 'URL too long'),
  filename: z.string().max(255, 'Filename too long'),
  sizeBytes: z.number().positive().optional(),
});

const linkInputSchema = z.object({
  url: z.string().url('Invalid link URL').max(500, 'URL too long'),
  title: z.string().max(255, 'Title too long').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  imageUrl: z.string().url('Invalid image URL').max(500, 'Image URL too long').optional(),
});

const createUpdateSchema = z.object({
  content: z.string()
    .min(1, 'Content is required')
    .max(10000, 'Content must be 10000 characters or less'),
  images: z.array(imageInputSchema).max(4, 'Maximum 4 images allowed').optional(),
  link: linkInputSchema.optional(),
});

const updateUpdateSchema = z.object({
  content: z.string()
    .min(1, 'Content cannot be empty')
    .max(10000, 'Content must be 10000 characters or less')
    .optional(),
});

const listUpdatesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/projects/:projectId/updates
 * Create a new update for a project
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id; // :id from parent projects router

    const validation = validate(createUpdateSchema, req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: formatZodErrors(validation.errors),
      });
      return;
    }

    const update = await createUpdate(req.user!.userId, projectId, validation.data);

    res.status(201).json({ update });
  } catch (error) {
    if (error instanceof UpdateError) {
      const statusCode = error.code === 'PROJECT_NOT_FOUND' ? 404 : 400;
      res.status(statusCode).json({ error: error.message, code: error.code });
      return;
    }
    console.error('Create update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/projects/:projectId/updates
 * List updates for a project with pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id; // :id from parent projects router

    const validation = validate(listUpdatesQuerySchema, req.query);
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: formatZodErrors(validation.errors),
      });
      return;
    }

    const result = await listUpdates(req.user!.userId, projectId, validation.data);

    res.json({
      updates: result.updates,
      total: result.total,
      hasMore: result.hasMore,
    });
  } catch (error) {
    if (error instanceof UpdateError) {
      const statusCode = error.code === 'PROJECT_NOT_FOUND' ? 404 : 400;
      res.status(statusCode).json({ error: error.message, code: error.code });
      return;
    }
    console.error('List updates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/projects/:projectId/updates/:id
 * Get a single update
 */
router.get('/:updateId', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id; // :id from parent projects router
    const updateId = req.params.updateId;

    const update = await getUpdate(req.user!.userId, projectId, updateId);

    if (!update) {
      res.status(404).json({ error: 'Update not found' });
      return;
    }

    res.json({ update });
  } catch (error) {
    if (error instanceof UpdateError) {
      const statusCode = error.code === 'PROJECT_NOT_FOUND' ? 404 : 400;
      res.status(statusCode).json({ error: error.message, code: error.code });
      return;
    }
    console.error('Get update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/projects/:projectId/updates/:id
 * Update an existing update (only content is editable)
 */
router.patch('/:updateId', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id; // :id from parent projects router
    const updateId = req.params.updateId;

    const validation = validate(updateUpdateSchema, req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: formatZodErrors(validation.errors),
      });
      return;
    }

    // If no content provided, nothing to update
    if (!validation.data.content) {
      res.status(400).json({ error: 'Content is required for update' });
      return;
    }

    const update = await updateUpdate(
      req.user!.userId,
      projectId,
      updateId,
      validation.data.content
    );

    if (!update) {
      res.status(404).json({ error: 'Update not found' });
      return;
    }

    res.json({ update });
  } catch (error) {
    if (error instanceof UpdateError) {
      const statusCode = error.code === 'PROJECT_NOT_FOUND' ? 404 : 400;
      res.status(statusCode).json({ error: error.message, code: error.code });
      return;
    }
    console.error('Patch update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/projects/:projectId/updates/:id
 * Delete an update
 */
router.delete('/:updateId', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id; // :id from parent projects router
    const updateId = req.params.updateId;

    const deleted = await deleteUpdate(req.user!.userId, projectId, updateId);

    if (!deleted) {
      res.status(404).json({ error: 'Update not found' });
      return;
    }

    res.json({ message: 'Update deleted' });
  } catch (error) {
    if (error instanceof UpdateError) {
      const statusCode = error.code === 'PROJECT_NOT_FOUND' ? 404 : 400;
      res.status(statusCode).json({ error: error.message, code: error.code });
      return;
    }
    console.error('Delete update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
