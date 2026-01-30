import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import { db } from '../db/index.js';
import { images, users } from '../db/schema/index.js';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';

// Allowed image types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

// Initialize S3 client (will be null in development mode without S3 config)
let s3Client: S3Client | null = null;

if (env.S3_ENDPOINT && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY) {
  s3Client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true, // Required for B2
  });
}

export class StorageError extends Error {
  constructor(
    message: string,
    public code:
      | 'INVALID_FILE_TYPE'
      | 'FILE_TOO_LARGE'
      | 'QUOTA_EXCEEDED'
      | 'UPLOAD_FAILED'
      | 'S3_NOT_CONFIGURED'
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Validate file type by checking mime type and extension
 */
export function validateFileType(
  mimeType: string,
  filename: string
): { valid: boolean; error?: string } {
  // Check mime type
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: `Invalid file type: ${mimeType}. Allowed: jpg, png, gif, webp`,
    };
  }

  // Check extension
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Invalid file extension: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Validate file size
 */
export function validateFileSize(sizeBytes: number): { valid: boolean; error?: string } {
  if (sizeBytes > env.MAX_FILE_SIZE_BYTES) {
    const maxMB = env.MAX_FILE_SIZE_BYTES / (1024 * 1024);
    const fileMB = (sizeBytes / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File too large: ${fileMB}MB. Maximum: ${maxMB}MB`,
    };
  }
  return { valid: true };
}

/**
 * Check if user has enough storage quota
 */
export async function checkStorageQuota(
  userId: string,
  additionalBytes: number
): Promise<{ allowed: boolean; currentUsed: number; limit: number }> {
  const [user] = await db
    .select({ storageUsedBytes: users.storageUsedBytes })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) {
    throw new Error('User not found');
  }

  const currentUsed = user.storageUsedBytes || 0;
  const newTotal = currentUsed + additionalBytes;

  return {
    allowed: newTotal <= env.MAX_STORAGE_BYTES,
    currentUsed,
    limit: env.MAX_STORAGE_BYTES,
  };
}

/**
 * Generate a unique filename for storage
 */
function generateStorageKey(userId: string, originalFilename: string): string {
  const ext = originalFilename.split('.').pop()?.toLowerCase() || 'jpg';
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `uploads/${userId}/${timestamp}-${random}.${ext}`;
}

/**
 * Upload an image to S3 storage
 * Returns mock URL if S3 is not configured (development mode)
 */
export async function uploadImage(
  userId: string,
  file: {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
    size: number;
  }
): Promise<{
  id: string;
  url: string;
  filename: string;
  sizeBytes: number;
}> {
  // Validate file type
  const typeValidation = validateFileType(file.mimetype, file.originalname);
  if (!typeValidation.valid) {
    throw new StorageError(typeValidation.error!, 'INVALID_FILE_TYPE');
  }

  // Validate file size
  const sizeValidation = validateFileSize(file.size);
  if (!sizeValidation.valid) {
    throw new StorageError(sizeValidation.error!, 'FILE_TOO_LARGE');
  }

  // Check storage quota
  const quota = await checkStorageQuota(userId, file.size);
  if (!quota.allowed) {
    const usedMB = (quota.currentUsed / (1024 * 1024)).toFixed(2);
    const limitMB = quota.limit / (1024 * 1024);
    throw new StorageError(
      `Storage quota exceeded. Used: ${usedMB}MB / ${limitMB}MB`,
      'QUOTA_EXCEEDED'
    );
  }

  const storageKey = generateStorageKey(userId, file.originalname);
  let publicUrl: string;

  // Upload to S3 if configured, otherwise use mock URL
  if (s3Client && env.S3_BUCKET) {
    try {
      const command = new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'max-age=31536000', // 1 year cache
      });

      await s3Client.send(command);

      // Construct public URL
      publicUrl = env.S3_PUBLIC_URL
        ? `${env.S3_PUBLIC_URL}/${storageKey}`
        : `${env.S3_ENDPOINT}/${env.S3_BUCKET}/${storageKey}`;
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new StorageError('Failed to upload image', 'UPLOAD_FAILED');
    }
  } else {
    // Development mode: return mock URL
    console.log('[DEV] S3 not configured, using mock URL');
    publicUrl = `https://mock-storage.statuspingme.local/${storageKey}`;
  }

  // Create image record in database (without updateId for now - will be linked when posting)
  // For now, we'll store it with a temporary reference and link it later
  // Actually, looking at the schema, images require an updateId
  // So we need to store uploaded images temporarily and link them when the update is created
  
  // For now, we'll return the upload info and the frontend will pass the URL when creating the update
  // The image record will be created when the update is posted

  // Update user's storage used
  await db
    .update(users)
    .set({
      storageUsedBytes: sql`${users.storageUsedBytes} + ${file.size}`,
    })
    .where(eq(users.id, userId));

  // Generate a temporary ID for frontend tracking
  const tempId = crypto.randomUUID();

  return {
    id: tempId,
    url: publicUrl,
    filename: file.originalname,
    sizeBytes: file.size,
  };
}

/**
 * Get a presigned URL for direct upload
 */
export async function getPresignedUploadUrl(
  userId: string,
  filename: string,
  contentType: string,
  sizeBytes: number
): Promise<{
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn: number;
}> {
  // Validate inputs
  const typeValidation = validateFileType(contentType, filename);
  if (!typeValidation.valid) {
    throw new StorageError(typeValidation.error!, 'INVALID_FILE_TYPE');
  }

  const sizeValidation = validateFileSize(sizeBytes);
  if (!sizeValidation.valid) {
    throw new StorageError(sizeValidation.error!, 'FILE_TOO_LARGE');
  }

  const quota = await checkStorageQuota(userId, sizeBytes);
  if (!quota.allowed) {
    const usedMB = (quota.currentUsed / (1024 * 1024)).toFixed(2);
    const limitMB = quota.limit / (1024 * 1024);
    throw new StorageError(
      `Storage quota exceeded. Used: ${usedMB}MB / ${limitMB}MB`,
      'QUOTA_EXCEEDED'
    );
  }

  if (!s3Client || !env.S3_BUCKET) {
    // Development mode: return mock presigned URL
    const key = generateStorageKey(userId, filename);
    return {
      uploadUrl: `https://mock-storage.statuspingme.local/presign/${key}`,
      publicUrl: `https://mock-storage.statuspingme.local/${key}`,
      key,
      expiresIn: 3600,
    };
  }

  const key = generateStorageKey(userId, filename);
  const expiresIn = 3600; // 1 hour

  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
    CacheControl: 'max-age=31536000',
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

  const publicUrl = env.S3_PUBLIC_URL
    ? `${env.S3_PUBLIC_URL}/${key}`
    : `${env.S3_ENDPOINT}/${env.S3_BUCKET}/${key}`;

  return {
    uploadUrl,
    publicUrl,
    key,
    expiresIn,
  };
}

/**
 * Confirm a presigned upload and update user storage
 */
export async function confirmUpload(
  userId: string,
  sizeBytes: number
): Promise<void> {
  await db
    .update(users)
    .set({
      storageUsedBytes: sql`${users.storageUsedBytes} + ${sizeBytes}`,
    })
    .where(eq(users.id, userId));
}

/**
 * Delete an image from storage
 */
export async function deleteImage(
  userId: string,
  key: string,
  sizeBytes: number
): Promise<void> {
  if (s3Client && env.S3_BUCKET) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
      });
      await s3Client.send(command);
    } catch (error) {
      console.error('S3 delete error:', error);
      // Don't throw - we still want to update the quota
    }
  }

  // Update user's storage used
  await db
    .update(users)
    .set({
      storageUsedBytes: sql`GREATEST(0, ${users.storageUsedBytes} - ${sizeBytes})`,
    })
    .where(eq(users.id, userId));
}

/**
 * Get user's storage usage
 */
export async function getStorageUsage(
  userId: string
): Promise<{ used: number; limit: number; percentage: number }> {
  const [user] = await db
    .select({ storageUsedBytes: users.storageUsedBytes })
    .from(users)
    .where(eq(users.id, userId));

  const used = user?.storageUsedBytes || 0;
  const limit = env.MAX_STORAGE_BYTES;
  const percentage = (used / limit) * 100;

  return { used, limit, percentage };
}
