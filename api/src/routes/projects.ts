import { Router, Request, Response } from 'express';
import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  archiveProject,
  unarchiveProject,
  updateProjectSettings,
  regenerateMagicLink,
  revokeMagicLink,
  getMagicLink,
  getProjectSubscribers,
  removeSubscriber,
  ProjectError,
} from '../services/projects.service.js';
import { requireAuth } from '../middleware/auth.js';
import {
  createProjectSchema,
  updateProjectSchema,
  listProjectsQuerySchema,
  updateProjectSettingsSchema,
  validate,
  formatZodErrors,
} from '../utils/validation.js';
import updatesRouter from './updates.js';

const router = Router();

// Mount updates router (nested under projects)
router.use('/:id/updates', updatesRouter);

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = validate(createProjectSchema, req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: formatZodErrors(validation.errors) });
      return;
    }

    const project = await createProject(req.user!.userId, validation.data);

    res.status(201).json({ project });
  } catch (error) {
    if (error instanceof ProjectError) {
      res.status(400).json({ error: error.message, code: error.code });
      return;
    }
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/projects
 * List user's projects with optional filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const validation = validate(listProjectsQuerySchema, req.query);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: formatZodErrors(validation.errors) });
      return;
    }

    const result = await listProjects(req.user!.userId, validation.data);

    res.json({ projects: result.projects, total: result.total });
  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/projects/:id
 * Get a single project
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const project = await getProject(req.user!.userId, req.params.id);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({ project });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/projects/:id
 * Update a project
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const validation = validate(updateProjectSchema, req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: formatZodErrors(validation.errors) });
      return;
    }

    const project = await updateProject(req.user!.userId, req.params.id, validation.data);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({ project });
  } catch (error) {
    if (error instanceof ProjectError) {
      res.status(400).json({ error: error.message, code: error.code });
      return;
    }
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/projects/:id/archive
 * Archive a project
 */
router.post('/:id/archive', async (req: Request, res: Response) => {
  try {
    const project = await archiveProject(req.user!.userId, req.params.id);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({ project, message: 'Project archived' });
  } catch (error) {
    console.error('Archive project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/projects/:id/unarchive
 * Restore an archived project
 */
router.post('/:id/unarchive', async (req: Request, res: Response) => {
  try {
    const project = await unarchiveProject(req.user!.userId, req.params.id);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({ project, message: 'Project restored' });
  } catch (error) {
    console.error('Unarchive project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/projects/:id/settings
 * Update project branding settings (logo URL, color)
 */
router.patch('/:id/settings', async (req: Request, res: Response) => {
  try {
    const validation = validate(updateProjectSettingsSchema, req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: formatZodErrors(validation.errors) });
      return;
    }

    const project = await updateProjectSettings(req.user!.userId, req.params.id, validation.data);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({ project });
  } catch (error) {
    console.error('Update project settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/projects/:id/magic-link
 * Get current magic link info for a project
 */
router.get('/:id/magic-link', async (req: Request, res: Response) => {
  try {
    const result = await getMagicLink(req.user!.userId, req.params.id);

    if (!result) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json(result);
  } catch (error) {
    console.error('Get magic link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/projects/:id/magic-link/regenerate
 * Generate a new magic link token (requires verified email)
 */
router.post('/:id/magic-link/regenerate', async (req: Request, res: Response) => {
  try {
    const result = await regenerateMagicLink(req.user!.userId, req.params.id);

    if (!result) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json(result);
  } catch (error) {
    if (error instanceof ProjectError && error.code === 'EMAIL_NOT_VERIFIED') {
      res.status(403).json({ error: 'Email verification required to generate magic links' });
      return;
    }
    console.error('Regenerate magic link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/projects/:id/magic-link
 * Revoke the magic link for a project
 */
router.delete('/:id/magic-link', async (req: Request, res: Response) => {
  try {
    const result = await revokeMagicLink(req.user!.userId, req.params.id);

    if (!result) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json(result);
  } catch (error) {
    console.error('Revoke magic link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/projects/:id/subscribers
 * Get list of subscribers for a project (owner only)
 */
router.get('/:id/subscribers', async (req: Request, res: Response) => {
  try {
    const result = await getProjectSubscribers(req.user!.userId, req.params.id);

    if (!result) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json(result);
  } catch (error) {
    console.error('Get subscribers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/projects/:id/subscribers/:subscriberId
 * Remove a subscriber from a project (owner only)
 */
router.delete('/:id/subscribers/:subscriberId', async (req: Request, res: Response) => {
  try {
    const result = await removeSubscriber(
      req.user!.userId,
      req.params.id,
      req.params.subscriberId
    );

    if (!result) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json(result);
  } catch (error) {
    if (error instanceof ProjectError && error.code === 'SUBSCRIBER_NOT_FOUND') {
      res.status(404).json({ error: 'Subscriber not found' });
      return;
    }
    console.error('Remove subscriber error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
