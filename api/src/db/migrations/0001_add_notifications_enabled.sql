-- Add notifications_enabled column to projects table
ALTER TABLE "projects" ADD COLUMN "notifications_enabled" boolean DEFAULT true;
