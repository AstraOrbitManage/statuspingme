import { pgTable, uuid, varchar, bigint, timestamp, index } from 'drizzle-orm/pg-core';
import { updates } from './updates';

export const images = pgTable('images', {
  id: uuid('id').primaryKey().defaultRandom(),
  updateId: uuid('update_id').notNull().references(() => updates.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 500 }).notNull(),
  filename: varchar('filename', { length: 255 }),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  updateIdIdx: index('idx_images_update_id').on(table.updateId),
}));

export type Image = typeof images.$inferSelect;
export type NewImage = typeof images.$inferInsert;
