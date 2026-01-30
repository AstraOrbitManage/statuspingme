import { z } from 'zod';

// Email validation
const emailSchema = z.string().email('Invalid email address').max(255, 'Email too long');

// Password validation (minimum 8 characters)
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');

// Name validation (optional)
const nameSchema = z.string().max(255, 'Name too long').optional();

// Auth Schemas
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

// Project Schemas
export const createProjectSchema = z.object({
  name: z.string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be 100 characters or less'),
  description: z.string().max(2000, 'Description too long').optional(),
  clientName: z.string().max(255, 'Client name too long').optional(),
  clientEmail: z.string().email('Invalid client email').max(255, 'Client email too long').optional(),
});

export const updateProjectSchema = z.object({
  name: z.string()
    .min(1, 'Project name cannot be empty')
    .max(100, 'Project name must be 100 characters or less')
    .optional(),
  description: z.string().max(2000, 'Description too long').optional(),
  clientName: z.string().max(255, 'Client name too long').optional(),
  clientEmail: z.string().email('Invalid client email').max(255, 'Client email too long').optional(),
});

export const listProjectsQuerySchema = z.object({
  status: z.enum(['active', 'archived']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// Hex color validation (#RRGGBB format)
const hexColorSchema = z.string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be in #RRGGBB format')
  .nullable();

// URL validation
const urlSchema = z.string()
  .url('Invalid URL format')
  .max(500, 'URL too long')
  .nullable();

export const updateProjectSettingsSchema = z.object({
  brandingLogoUrl: urlSchema.optional(),
  brandingColor: hexColorSchema.optional(),
  notificationsEnabled: z.boolean().optional(),
});

// Types derived from schemas
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
export type UpdateProjectSettingsInput = z.infer<typeof updateProjectSettingsSchema>;

/**
 * Validate request body and return result
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Format Zod errors into a user-friendly array
 */
export function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
}
