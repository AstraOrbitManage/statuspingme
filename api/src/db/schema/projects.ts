import { pgTable, uuid, varchar, text, timestamp, index, boolean } from 'drizzle-orm/pg-core';
import { users } from './users';

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  clientName: varchar('client_name', { length: 255 }),
  clientEmail: varchar('client_email', { length: 255 }),
  status: varchar('status', { length: 50 }).default('active'),
  magicLinkToken: varchar('magic_link_token', { length: 255 }).unique(),
  brandingLogoUrl: varchar('branding_logo_url', { length: 500 }),
  brandingColor: varchar('branding_color', { length: 7 }),
  notificationsEnabled: boolean('notifications_enabled').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_projects_user_id').on(table.userId),
  magicLinkIdx: index('idx_projects_magic_link').on(table.magicLinkToken),
}));

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
