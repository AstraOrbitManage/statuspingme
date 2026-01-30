import { Router, Request, Response } from 'express';
import {
  signup,
  login,
  logout,
  refreshAccessToken,
  getCurrentUser,
  verifyEmail,
  resendVerification,
  AuthError,
} from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.js';
import {
  signupSchema,
  loginSchema,
  refreshTokenSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  validate,
  formatZodErrors,
} from '../utils/validation.js';

const router = Router();

/**
 * POST /api/auth/signup
 * Create a new user account
 */
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const validation = validate(signupSchema, req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: formatZodErrors(validation.errors) });
      return;
    }

    const { email, password, name } = validation.data;
    const { user, verificationToken } = await signup(email, password, name);

    // Mock email sending - just log it
    console.log(`📧 [MOCK EMAIL] Verification email to ${email}`);
    console.log(`   Token: ${verificationToken}`);
    console.log(`   Link: http://localhost:3000/verify-email?token=${verificationToken}`);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      message: 'Verification email sent',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const status = error.code === 'EMAIL_EXISTS' ? 409 : 400;
      res.status(status).json({ error: error.message, code: error.code });
      return;
    }
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return tokens
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const validation = validate(loginSchema, req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: formatZodErrors(validation.errors) });
      return;
    }

    const { email, password } = validation.data;
    const result = await login(email, password);

    res.json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(401).json({ error: error.message, code: error.code });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/logout
 * Invalidate refresh token
 */
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    const validation = validate(refreshTokenSchema, req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: formatZodErrors(validation.errors) });
      return;
    }

    const { refreshToken } = validation.data;
    await logout(req.user!.userId, refreshToken);

    res.json({ message: 'Logged out' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/refresh
 * Get new access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const validation = validate(refreshTokenSchema, req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: formatZodErrors(validation.errors) });
      return;
    }

    const { refreshToken } = validation.data;
    const result = await refreshAccessToken(refreshToken);

    res.json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(401).json({ error: error.message, code: error.code });
      return;
    }
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile (protected)
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUser(req.user!.userId);

    res.json({ user });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(404).json({ error: error.message, code: error.code });
      return;
    }
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/verify-email
 * Verify email with token
 */
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const validation = validate(verifyEmailSchema, req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: formatZodErrors(validation.errors) });
      return;
    }

    const { token } = validation.data;
    await verifyEmail(token);

    res.json({ message: 'Email verified' });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(400).json({ error: error.message, code: error.code });
      return;
    }
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/resend-verification
 * Resend verification email
 */
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const validation = validate(resendVerificationSchema, req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: formatZodErrors(validation.errors) });
      return;
    }

    const { email } = validation.data;
    
    try {
      const verificationToken = await resendVerification(email);
      
      // Mock email sending - just log it
      console.log(`📧 [MOCK EMAIL] Verification email resent to ${email}`);
      console.log(`   Token: ${verificationToken}`);
      console.log(`   Link: http://localhost:3000/verify-email?token=${verificationToken}`);
    } catch (error) {
      // Don't reveal if email exists or not (except for already verified)
      if (error instanceof AuthError && error.code === 'ALREADY_VERIFIED') {
        res.status(400).json({ error: error.message, code: error.code });
        return;
      }
      // For other errors, still return success to prevent email enumeration
    }

    res.json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
