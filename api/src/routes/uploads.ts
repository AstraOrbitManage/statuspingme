import { Router, Request, Response } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import {
  uploadImage,
  getPresignedUploadUrl,
  confirmUpload,
  getStorageUsage,
  StorageError,
} from '../services/storage.service.js';
import { z } from 'zod';
import { validate, formatZodErrors } from '../utils/validation.js';

const router = Router();

// Configure multer for memory storage (files stay in memory for S3 upload)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1, // Single file per request
  },
  fileFilter: (_req, file, cb) => {
    // Allow only images
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only jpg, png, gif, webp allowed.'));
    }
  },
});

// Validation schemas
const presignSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  sizeBytes: z.coerce.number().positive().max(10 * 1024 * 1024),
});

const confirmUploadSchema = z.object({
  sizeBytes: z.coerce.number().positive(),
});

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/uploads/image
 * Upload an image directly (multipart/form-data)
 */
router.post(
  '/image',
  upload.single('image'),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'No image file provided' });
        return;
      }

      const result = await uploadImage(req.user!.userId, {
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
        size: file.size,
      });

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof StorageError) {
        const statusCode =
          error.code === 'QUOTA_EXCEEDED' ? 403 : 400;
        res.status(statusCode).json({
          error: error.message,
          code: error.code,
        });
        return;
      }

      // Multer errors
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            error: 'File too large. Maximum size is 10MB.',
            code: 'FILE_TOO_LARGE',
          });
          return;
        }
        res.status(400).json({
          error: error.message,
          code: error.code,
        });
        return;
      }

      // Generic multer filter error
      if (error instanceof Error && error.message.includes('Invalid file type')) {
        res.status(400).json({
          error: error.message,
          code: 'INVALID_FILE_TYPE',
        });
        return;
      }

      console.error('Upload error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/uploads/presign
 * Get a presigned URL for direct upload to S3
 */
router.get('/presign', async (req: Request, res: Response) => {
  try {
    const validation = validate(presignSchema, req.query);
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: formatZodErrors(validation.errors),
      });
      return;
    }

    const { filename, contentType, sizeBytes } = validation.data;

    const result = await getPresignedUploadUrl(
      req.user!.userId,
      filename,
      contentType,
      sizeBytes
    );

    res.json(result);
  } catch (error) {
    if (error instanceof StorageError) {
      const statusCode = error.code === 'QUOTA_EXCEEDED' ? 403 : 400;
      res.status(statusCode).json({
        error: error.message,
        code: error.code,
      });
      return;
    }

    console.error('Presign error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/uploads/confirm
 * Confirm a presigned upload completed (updates storage quota)
 */
router.post('/confirm', async (req: Request, res: Response) => {
  try {
    const validation = validate(confirmUploadSchema, req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: formatZodErrors(validation.errors),
      });
      return;
    }

    await confirmUpload(req.user!.userId, validation.data.sizeBytes);

    res.json({ success: true });
  } catch (error) {
    console.error('Confirm upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/uploads/usage
 * Get user's storage usage statistics
 */
router.get('/usage', async (req: Request, res: Response) => {
  try {
    const usage = await getStorageUsage(req.user!.userId);

    res.json({
      usedBytes: usage.used,
      limitBytes: usage.limit,
      usedMB: (usage.used / (1024 * 1024)).toFixed(2),
      limitMB: usage.limit / (1024 * 1024),
      percentage: usage.percentage.toFixed(1),
    });
  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
