import { pgTable, uuid, varchar, jsonb, integer, timestamp, index } from 'drizzle-orm/pg-core';

export const jobQueue = pgTable('job_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 50 }).default('pending'),
  attempts: integer('attempts').default(0),
  scheduledFor: timestamp('scheduled_for').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  statusScheduledIdx: index('idx_job_queue_status').on(table.status, table.scheduledFor),
}));

export type Job = typeof jobQueue.$inferSelect;
export type NewJob = typeof jobQueue.$inferInsert;
