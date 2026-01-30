import { pgTable, uuid, varchar, timestamp, bigint } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  emailVerifiedAt: timestamp('email_verified_at'),
  verificationToken: varchar('verification_token', { length: 255 }),
  verificationExpiresAt: timestamp('verification_expires_at'),
  storageUsedBytes: bigint('storage_used_bytes', { mode: 'number' }).default(0),
  tier: varchar('tier', { length: 50 }).default('free'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
