import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || '',
  
  // JWT Configuration
  JWT_SECRET: process.env.JWT_SECRET || 'development-secret-change-in-production-min-32-chars',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  
  // App URL for magic links
  APP_URL: process.env.APP_URL || 'http://localhost:5173',
  
  // S3-Compatible Storage (Backblaze B2)
  S3_ENDPOINT: process.env.S3_ENDPOINT || '',
  S3_REGION: process.env.S3_REGION || 'us-west-000',
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID || '',
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY || '',
  S3_BUCKET: process.env.S3_BUCKET || 'statuspingme-uploads',
  S3_PUBLIC_URL: process.env.S3_PUBLIC_URL || '',
  
  // Storage limits
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB per file
  MAX_STORAGE_BYTES: 100 * 1024 * 1024, // 100MB per user
  
  // Email Configuration (Resend)
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'updates@statuspingme.com',
} as const;

// Validate required env vars in production
if (env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production');
  }
}
