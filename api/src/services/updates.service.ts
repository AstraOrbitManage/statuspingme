import { eq, and, count, desc } from 'drizzle-orm';
import { db, updates, images, links, projects, Update, NewUpdate, Image, Link } from '../db/index.js';
import { triggerInstantDigest } from '../jobs/digest.job.js';

export interface ImageInput {
  url: string;
  filename: string;
  sizeBytes?: number;
}

export interface LinkInput {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
}

export interface UpdateWithAttachments {
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
  link: {
    id: string;
    url: string;
    title: string | null;
    description: string | null;
    imageUrl: string | null;
  } | null;
}

export interface CreateUpdateInput {
  content: string;
  images?: ImageInput[];
  link?: LinkInput;
}

export interface ListUpdatesOptions {
  limit?: number;
  offset?: number;
}

export class UpdateError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'UpdateError';
  }
}

/**
 * Verify project exists and belongs to user
 * Returns project if found, null otherwise
 */
export async function verifyProjectOwnership(
  userId: string,
  projectId: string
): Promise<boolean> {
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.userId, userId)
    ),
    columns: { id: true },
  });

  return project !== null && project !== undefined;
}

/**
 * Get update with its images and link
 */
async function getUpdateWithAttachments(updateId: string): Promise<UpdateWithAttachments | null> {
  const update = await db.query.updates.findFirst({
    where: eq(updates.id, updateId),
  });

  if (!update) {
    return null;
  }

  // Get associated images
  const updateImages = await db
    .select({
      id: images.id,
      url: images.url,
      filename: images.filename,
    })
    .from(images)
    .where(eq(images.updateId, updateId));

  // Get associated link (max 1)
  const updateLinks = await db
    .select({
      id: links.id,
      url: links.url,
      title: links.title,
      description: links.description,
      imageUrl: links.imageUrl,
    })
    .from(links)
    .where(eq(links.updateId, updateId))
    .limit(1);

  // Use createdAt as updatedAt since schema doesn't have updatedAt column
  const createdAt = update.createdAt ?? new Date();
  
  return {
    id: update.id,
    projectId: update.projectId,
    content: update.content,
    createdAt,
    updatedAt: createdAt, // No updatedAt in schema, use createdAt as fallback
    images: updateImages,
    link: updateLinks[0] || null,
  };
}

/**
 * Create a new update for a project
 */
export async function createUpdate(
  userId: string,
  projectId: string,
  input: CreateUpdateInput
): Promise<UpdateWithAttachments> {
  // Verify project ownership
  const isOwner = await verifyProjectOwnership(userId, projectId);
  if (!isOwner) {
    throw new UpdateError('Project not found or access denied', 'PROJECT_NOT_FOUND');
  }

  // Validate images count
  if (input.images && input.images.length > 4) {
    throw new UpdateError('Maximum 4 images allowed per update', 'TOO_MANY_IMAGES');
  }

  // Create the update
  const [newUpdate] = await db
    .insert(updates)
    .values({
      projectId,
      content: input.content,
    })
    .returning();

  // Create image records if provided
  if (input.images && input.images.length > 0) {
    await db.insert(images).values(
      input.images.map((img) => ({
        updateId: newUpdate.id,
        url: img.url,
        filename: img.filename || null,
        sizeBytes: img.sizeBytes || null,
      }))
    );
  }

  // Create link record if provided
  if (input.link) {
    await db.insert(links).values({
      updateId: newUpdate.id,
      url: input.link.url,
      title: input.link.title || null,
      description: input.link.description || null,
      imageUrl: input.link.imageUrl || null,
    });
  }

  // Trigger instant digest notifications (fire and forget)
  triggerInstantDigest(projectId, newUpdate.id).catch(err => {
    console.error('[Updates] Failed to trigger instant digest:', err);
  });

  // Return full update with attachments
  const result = await getUpdateWithAttachments(newUpdate.id);
  return result!;
}

/**
 * List updates for a project with pagination
 */
export async function listUpdates(
  userId: string,
  projectId: string,
  options: ListUpdatesOptions = {}
): Promise<{ updates: UpdateWithAttachments[]; total: number; hasMore: boolean }> {
  const { limit = 20, offset = 0 } = options;

  // Verify project ownership
  const isOwner = await verifyProjectOwnership(userId, projectId);
  if (!isOwner) {
    throw new UpdateError('Project not found or access denied', 'PROJECT_NOT_FOUND');
  }

  // Get updates with pagination, newest first
  const updatesList = await db
    .select()
    .from(updates)
    .where(eq(updates.projectId, projectId))
    .orderBy(desc(updates.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [{ count: totalCount }] = await db
    .select({ count: count() })
    .from(updates)
    .where(eq(updates.projectId, projectId));

  const total = Number(totalCount);

  // Get attachments for each update
  const updatesWithAttachments: UpdateWithAttachments[] = [];

  for (const update of updatesList) {
    const withAttachments = await getUpdateWithAttachments(update.id);
    if (withAttachments) {
      updatesWithAttachments.push(withAttachments);
    }
  }

  return {
    updates: updatesWithAttachments,
    total,
    hasMore: offset + limit < total,
  };
}

/**
 * Get a single update by ID
 */
export async function getUpdate(
  userId: string,
  projectId: string,
  updateId: string
): Promise<UpdateWithAttachments | null> {
  // Verify project ownership
  const isOwner = await verifyProjectOwnership(userId, projectId);
  if (!isOwner) {
    throw new UpdateError('Project not found or access denied', 'PROJECT_NOT_FOUND');
  }

  // Get the update
  const update = await db.query.updates.findFirst({
    where: and(
      eq(updates.id, updateId),
      eq(updates.projectId, projectId)
    ),
  });

  if (!update) {
    return null;
  }

  return getUpdateWithAttachments(updateId);
}

/**
 * Update an existing update (only content is editable)
 */
export async function updateUpdate(
  userId: string,
  projectId: string,
  updateId: string,
  content: string
): Promise<UpdateWithAttachments | null> {
  // Verify project ownership
  const isOwner = await verifyProjectOwnership(userId, projectId);
  if (!isOwner) {
    throw new UpdateError('Project not found or access denied', 'PROJECT_NOT_FOUND');
  }

  // Check if update exists and belongs to project
  const existing = await db.query.updates.findFirst({
    where: and(
      eq(updates.id, updateId),
      eq(updates.projectId, projectId)
    ),
  });

  if (!existing) {
    return null;
  }

  // Update the content
  // Note: updates table doesn't have updatedAt column, so we just update content
  await db
    .update(updates)
    .set({ content })
    .where(eq(updates.id, updateId));

  return getUpdateWithAttachments(updateId);
}

/**
 * Delete an update
 * Images and links are cascade deleted by the schema
 */
export async function deleteUpdate(
  userId: string,
  projectId: string,
  updateId: string
): Promise<boolean> {
  // Verify project ownership
  const isOwner = await verifyProjectOwnership(userId, projectId);
  if (!isOwner) {
    throw new UpdateError('Project not found or access denied', 'PROJECT_NOT_FOUND');
  }

  // Check if update exists and belongs to project
  const existing = await db.query.updates.findFirst({
    where: and(
      eq(updates.id, updateId),
      eq(updates.projectId, projectId)
    ),
  });

  if (!existing) {
    return false;
  }

  // Delete the update (images and links cascade delete)
  await db
    .delete(updates)
    .where(eq(updates.id, updateId));

  return true;
}
