import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { updates } from './updates';

export const links = pgTable('links', {
  id: uuid('id').primaryKey().defaultRandom(),
  updateId: uuid('update_id').notNull().references(() => updates.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 500 }).notNull(),
  title: varchar('title', { length: 255 }),
  description: text('description'),
  imageUrl: varchar('image_url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  updateIdIdx: index('idx_links_update_id').on(table.updateId),
}));

export type Link = typeof links.$inferSelect;
export type NewLink = typeof links.$inferInsert;
