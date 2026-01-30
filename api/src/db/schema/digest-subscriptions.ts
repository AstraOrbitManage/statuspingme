import { pgTable, uuid, varchar, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { projects } from './projects';

export const digestSubscriptions = pgTable('digest_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  frequency: varchar('frequency', { length: 50 }).default('instant'),
  lastSentAt: timestamp('last_sent_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  projectIdIdx: index('idx_digest_subs_project_id').on(table.projectId),
  projectEmailUnique: unique('digest_subscriptions_project_email').on(table.projectId, table.email),
}));

export type DigestSubscription = typeof digestSubscriptions.$inferSelect;
export type NewDigestSubscription = typeof digestSubscriptions.$inferInsert;
