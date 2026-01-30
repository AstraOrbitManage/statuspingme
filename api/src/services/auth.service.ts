import { eq, and, gt, lt } from 'drizzle-orm';
import { db, users, refreshTokens, User } from '../db/index.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  getRefreshTokenExpiry,
  generateVerificationToken,
  getVerificationTokenExpiry,
  TokenPayload,
} from '../utils/jwt.js';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  tier: string | null;
  storageUsed: number;
}

/**
 * Create a new user account
 */
export async function signup(
  email: string,
  password: string,
  name?: string
): Promise<{ user: { id: string; email: string; name: string | null }; verificationToken: string }> {
  // Check if user exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  if (existingUser) {
    throw new AuthError('Email already registered', 'EMAIL_EXISTS');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Generate verification token
  const verificationToken = generateVerificationToken();
  const verificationExpiresAt = getVerificationTokenExpiry();

  // Create user
  const [newUser] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      name: name || null,
      verificationToken,
      verificationExpiresAt,
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
    });

  return { user: newUser, verificationToken };
}

/**
 * Authenticate user and return tokens
 */
export async function login(email: string, password: string): Promise<AuthResult> {
  // Find user
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  if (!user) {
    throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Generate tokens
  const tokenPayload: TokenPayload = {
    userId: user.id,
    email: user.email,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken();

  // Store refresh token hash
  const tokenHash = hashRefreshToken(refreshToken);
  const expiresAt = getRefreshTokenExpiry();

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: !!user.emailVerifiedAt,
    },
  };
}

/**
 * Invalidate a refresh token
 */
export async function logout(userId: string, refreshToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(refreshToken);

  const result = await db
    .delete(refreshTokens)
    .where(and(eq(refreshTokens.userId, userId), eq(refreshTokens.tokenHash, tokenHash)));
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const tokenHash = hashRefreshToken(refreshToken);

  // Find valid refresh token
  const storedToken = await db.query.refreshTokens.findFirst({
    where: and(
      eq(refreshTokens.tokenHash, tokenHash),
      gt(refreshTokens.expiresAt, new Date())
    ),
  });

  if (!storedToken) {
    throw new AuthError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }

  // Get user
  const user = await db.query.users.findFirst({
    where: eq(users.id, storedToken.userId),
  });

  if (!user) {
    throw new AuthError('User not found', 'USER_NOT_FOUND');
  }

  // Delete old refresh token
  await db.delete(refreshTokens).where(eq(refreshTokens.id, storedToken.id));

  // Generate new tokens
  const tokenPayload: TokenPayload = {
    userId: user.id,
    email: user.email,
  };

  const newAccessToken = generateAccessToken(tokenPayload);
  const newRefreshToken = generateRefreshToken();

  // Store new refresh token hash
  const newTokenHash = hashRefreshToken(newRefreshToken);
  const expiresAt = getRefreshTokenExpiry();

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: newTokenHash,
    expiresAt,
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

/**
 * Get current user profile
 */
export async function getCurrentUser(userId: string): Promise<UserProfile> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new AuthError('User not found', 'USER_NOT_FOUND');
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: !!user.emailVerifiedAt,
    tier: user.tier,
    storageUsed: user.storageUsedBytes || 0,
  };
}

/**
 * Verify email with token
 */
export async function verifyEmail(token: string): Promise<void> {
  const user = await db.query.users.findFirst({
    where: and(
      eq(users.verificationToken, token),
      gt(users.verificationExpiresAt, new Date())
    ),
  });

  if (!user) {
    throw new AuthError('Invalid or expired verification token', 'INVALID_VERIFICATION_TOKEN');
  }

  await db
    .update(users)
    .set({
      emailVerifiedAt: new Date(),
      verificationToken: null,
      verificationExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
}

/**
 * Resend verification email
 */
export async function resendVerification(email: string): Promise<string> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  if (!user) {
    // Don't reveal if email exists or not
    throw new AuthError('If this email exists, a verification link has been sent', 'EMAIL_SENT');
  }

  if (user.emailVerifiedAt) {
    throw new AuthError('Email already verified', 'ALREADY_VERIFIED');
  }

  // Generate new verification token
  const verificationToken = generateVerificationToken();
  const verificationExpiresAt = getVerificationTokenExpiry();

  await db
    .update(users)
    .set({
      verificationToken,
      verificationExpiresAt,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return verificationToken;
}

/**
 * Clean up expired refresh tokens (can be called periodically)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await db
    .delete(refreshTokens)
    .where(lt(refreshTokens.expiresAt, new Date()));
  
  return 0; // Drizzle doesn't return affected rows easily, would need raw query
}

// Custom error class for auth errors
export class AuthError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'AuthError';
  }
}
