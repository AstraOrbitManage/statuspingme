import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';

/**
 * Middleware to verify JWT access token
 * Extracts token from Authorization header (Bearer scheme)
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.status(401).json({ error: 'Authorization header missing' });
    return;
  }
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({ error: 'Invalid authorization format. Use: Bearer <token>' });
    return;
  }
  
  const token = parts[1];
  const decoded = verifyAccessToken(token);
  
  if (!decoded) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  
  // Attach user info to request
  req.user = {
    userId: decoded.userId,
    email: decoded.email,
  };
  
  next();
}

/**
 * Optional auth middleware - doesn't fail if no token, but sets user if valid
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    next();
    return;
  }
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    next();
    return;
  }
  
  const token = parts[1];
  const decoded = verifyAccessToken(token);
  
  if (decoded) {
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };
  }
  
  next();
}
