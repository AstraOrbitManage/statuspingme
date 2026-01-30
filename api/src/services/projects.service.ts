import { eq, and, count, desc } from 'drizzle-orm';
import { db, projects, Project, NewProject, users, digestSubscriptions } from '../db/index.js';
import crypto from 'crypto';
import { env } from '../config/env.js';

export interface ProjectResponse {
  id: string;
  name: string;
  description: string | null;
  clientName: string | null;
  clientEmail: string | null;
  status: string;
  magicLinkToken: string | null;
  brandingLogoUrl: string | null;
  brandingColor: string | null;
  notificationsEnabled: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  clientName?: string;
  clientEmail?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  clientName?: string;
  clientEmail?: string;
}

export interface UpdateProjectSettingsInput {
  brandingLogoUrl?: string | null;
  brandingColor?: string | null;
  notificationsEnabled?: boolean;
}

export interface MagicLinkResponse {
  magicLinkToken: string | null;
  magicLinkUrl: string | null;
  hasActiveLink: boolean;
}

export interface MagicLinkRegenerateResponse {
  magicLinkToken: string;
  magicLinkUrl: string;
  message: string;
}

export interface ListProjectsOptions {
  status?: 'active' | 'archived';
  limit?: number;
  offset?: number;
}

/**
 * Create a new project for a user
 */
export async function createProject(
  userId: string,
  input: CreateProjectInput
): Promise<ProjectResponse> {
  // Generate a unique magic link token
  const magicLinkToken = crypto.randomBytes(32).toString('hex');

  const [project] = await db
    .insert(projects)
    .values({
      userId,
      name: input.name,
      description: input.description || null,
      clientName: input.clientName || null,
      clientEmail: input.clientEmail || null,
      status: 'active',
      magicLinkToken,
    })
    .returning();

  return formatProject(project);
}

/**
 * Get all projects for a user with optional filtering
 */
export async function listProjects(
  userId: string,
  options: ListProjectsOptions = {}
): Promise<{ projects: ProjectResponse[]; total: number }> {
  const { status, limit = 50, offset = 0 } = options;

  // Build where conditions
  const conditions = [eq(projects.userId, userId)];
  if (status) {
    conditions.push(eq(projects.status, status));
  }

  // Get projects with pagination
  const projectsList = await db
    .select()
    .from(projects)
    .where(and(...conditions))
    .orderBy(desc(projects.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [{ count: total }] = await db
    .select({ count: count() })
    .from(projects)
    .where(and(...conditions));

  return {
    projects: projectsList.map(formatProject),
    total: Number(total),
  };
}

/**
 * Get a single project by ID (only if owned by user)
 */
export async function getProject(
  userId: string,
  projectId: string
): Promise<ProjectResponse | null> {
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.userId, userId)
    ),
  });

  if (!project) {
    return null;
  }

  return formatProject(project);
}

/**
 * Update a project (only if owned by user)
 */
export async function updateProject(
  userId: string,
  projectId: string,
  input: UpdateProjectInput
): Promise<ProjectResponse | null> {
  // First check if project exists and belongs to user
  const existing = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.userId, userId)
    ),
  });

  if (!existing) {
    return null;
  }

  // Build update object
  const updateData: Partial<NewProject> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) {
    updateData.name = input.name;
  }
  if (input.description !== undefined) {
    updateData.description = input.description || null;
  }
  if (input.clientName !== undefined) {
    updateData.clientName = input.clientName || null;
  }
  if (input.clientEmail !== undefined) {
    updateData.clientEmail = input.clientEmail || null;
  }

  const [updated] = await db
    .update(projects)
    .set(updateData)
    .where(and(
      eq(projects.id, projectId),
      eq(projects.userId, userId)
    ))
    .returning();

  return formatProject(updated);
}

/**
 * Archive a project (only if owned by user)
 */
export async function archiveProject(
  userId: string,
  projectId: string
): Promise<ProjectResponse | null> {
  // First check if project exists and belongs to user
  const existing = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.userId, userId)
    ),
  });

  if (!existing) {
    return null;
  }

  const [updated] = await db
    .update(projects)
    .set({
      status: 'archived',
      updatedAt: new Date(),
    })
    .where(and(
      eq(projects.id, projectId),
      eq(projects.userId, userId)
    ))
    .returning();

  return formatProject(updated);
}

/**
 * Unarchive (restore) a project (only if owned by user)
 */
export async function unarchiveProject(
  userId: string,
  projectId: string
): Promise<ProjectResponse | null> {
  // First check if project exists and belongs to user
  const existing = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.userId, userId)
    ),
  });

  if (!existing) {
    return null;
  }

  const [updated] = await db
    .update(projects)
    .set({
      status: 'active',
      updatedAt: new Date(),
    })
    .where(and(
      eq(projects.id, projectId),
      eq(projects.userId, userId)
    ))
    .returning();

  return formatProject(updated);
}

/**
 * Update project branding settings
 */
export async function updateProjectSettings(
  userId: string,
  projectId: string,
  input: UpdateProjectSettingsInput
): Promise<ProjectResponse | null> {
  // Check if project exists and belongs to user
  const existing = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.userId, userId)
    ),
  });

  if (!existing) {
    return null;
  }

  // Build update object
  const updateData: Partial<NewProject> = {
    updatedAt: new Date(),
  };

  if (input.brandingLogoUrl !== undefined) {
    updateData.brandingLogoUrl = input.brandingLogoUrl;
  }
  if (input.brandingColor !== undefined) {
    updateData.brandingColor = input.brandingColor;
  }
  if (input.notificationsEnabled !== undefined) {
    updateData.notificationsEnabled = input.notificationsEnabled;
  }

  const [updated] = await db
    .update(projects)
    .set(updateData)
    .where(and(
      eq(projects.id, projectId),
      eq(projects.userId, userId)
    ))
    .returning();

  return formatProject(updated);
}

/**
 * Check if user's email is verified
 */
export async function isUserEmailVerified(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { emailVerifiedAt: true },
  });

  return user?.emailVerifiedAt !== null;
}

/**
 * Regenerate magic link token for a project
 * Requires user email to be verified
 */
export async function regenerateMagicLink(
  userId: string,
  projectId: string
): Promise<MagicLinkRegenerateResponse | null> {
  // Check if project exists and belongs to user
  const existing = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.userId, userId)
    ),
  });

  if (!existing) {
    return null;
  }

  // Check email verification (will throw if not verified)
  const emailVerified = await isUserEmailVerified(userId);
  if (!emailVerified) {
    throw new ProjectError('Email verification required to generate magic links', 'EMAIL_NOT_VERIFIED');
  }

  // Generate new token (32 bytes = 64 hex chars)
  const newToken = crypto.randomBytes(32).toString('hex');

  await db
    .update(projects)
    .set({
      magicLinkToken: newToken,
      updatedAt: new Date(),
    })
    .where(and(
      eq(projects.id, projectId),
      eq(projects.userId, userId)
    ));

  return {
    magicLinkToken: newToken,
    magicLinkUrl: `${env.APP_URL}/p/${newToken}`,
    message: 'Magic link regenerated',
  };
}

/**
 * Revoke (delete) magic link for a project
 */
export async function revokeMagicLink(
  userId: string,
  projectId: string
): Promise<{ message: string } | null> {
  // Check if project exists and belongs to user
  const existing = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.userId, userId)
    ),
  });

  if (!existing) {
    return null;
  }

  await db
    .update(projects)
    .set({
      magicLinkToken: null,
      updatedAt: new Date(),
    })
    .where(and(
      eq(projects.id, projectId),
      eq(projects.userId, userId)
    ));

  return { message: 'Magic link revoked' };
}

/**
 * Get magic link info for a project
 */
export async function getMagicLink(
  userId: string,
  projectId: string
): Promise<MagicLinkResponse | null> {
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.userId, userId)
    ),
    columns: { magicLinkToken: true },
  });

  if (!project) {
    return null;
  }

  const hasToken = project.magicLinkToken !== null;

  return {
    magicLinkToken: project.magicLinkToken,
    magicLinkUrl: hasToken ? `${env.APP_URL}/p/${project.magicLinkToken}` : null,
    hasActiveLink: hasToken,
  };
}

// Custom error class for project errors
export class ProjectError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'ProjectError';
  }
}

/**
 * Format project for API response
 */
function formatProject(project: Project): ProjectResponse {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    clientName: project.clientName,
    clientEmail: project.clientEmail,
    status: project.status || 'active',
    magicLinkToken: project.magicLinkToken,
    brandingLogoUrl: project.brandingLogoUrl,
    brandingColor: project.brandingColor,
    notificationsEnabled: project.notificationsEnabled ?? true,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

// ============================================================
// Subscriber Management
// ============================================================

export interface SubscriberResponse {
  id: string;
  email: string;
  frequency: 'instant' | 'daily' | 'weekly';
  subscribedAt: Date | null;
  lastSentAt: Date | null;
}

export interface ListSubscribersResponse {
  subscribers: SubscriberResponse[];
  total: number;
}

/**
 * Get list of subscribers for a project (owner only)
 */
export async function getProjectSubscribers(
  userId: string,
  projectId: string
): Promise<ListSubscribersResponse | null> {
  // Check if project exists and belongs to user
  const existing = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.userId, userId)
    ),
  });

  if (!existing) {
    return null;
  }

  // Get all subscribers for this project
  const subscribers = await db
    .select()
    .from(digestSubscriptions)
    .where(eq(digestSubscriptions.projectId, projectId))
    .orderBy(desc(digestSubscriptions.createdAt));

  // Get total count
  const [{ count: total }] = await db
    .select({ count: count() })
    .from(digestSubscriptions)
    .where(eq(digestSubscriptions.projectId, projectId));

  return {
    subscribers: subscribers.map((sub) => ({
      id: sub.id,
      email: sub.email,
      frequency: (sub.frequency || 'instant') as 'instant' | 'daily' | 'weekly',
      subscribedAt: sub.createdAt,
      lastSentAt: sub.lastSentAt,
    })),
    total: Number(total),
  };
}

/**
 * Get subscriber count for a project (owner only)
 */
export async function getProjectSubscriberCount(
  userId: string,
  projectId: string
): Promise<number | null> {
  // Check if project exists and belongs to user
  const existing = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.userId, userId)
    ),
  });

  if (!existing) {
    return null;
  }

  const [{ count: total }] = await db
    .select({ count: count() })
    .from(digestSubscriptions)
    .where(eq(digestSubscriptions.projectId, projectId));

  return Number(total);
}

/**
 * Remove a subscriber from a project (owner only)
 */
export async function removeSubscriber(
  userId: string,
  projectId: string,
  subscriberId: string
): Promise<{ message: string } | null> {
  // Check if project exists and belongs to user
  const existing = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.userId, userId)
    ),
  });

  if (!existing) {
    return null;
  }

  // Check if subscriber exists for this project
  const subscriber = await db.query.digestSubscriptions.findFirst({
    where: and(
      eq(digestSubscriptions.id, subscriberId),
      eq(digestSubscriptions.projectId, projectId)
    ),
  });

  if (!subscriber) {
    throw new ProjectError('Subscriber not found', 'SUBSCRIBER_NOT_FOUND');
  }

  // Delete the subscriber
  await db
    .delete(digestSubscriptions)
    .where(and(
      eq(digestSubscriptions.id, subscriberId),
      eq(digestSubscriptions.projectId, projectId)
    ));

  return { message: 'Subscriber removed' };
}
