import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { projects } from './projects';

export const updates = pgTable('updates', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  projectIdIdx: index('idx_updates_project_id').on(table.projectId),
  createdAtIdx: index('idx_updates_created_at').on(table.createdAt),
}));

export type Update = typeof updates.$inferSelect;
export type NewUpdate = typeof updates.$inferInsert;
