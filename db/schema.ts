import { bigint, index, integer, pgTable, text } from 'drizzle-orm/pg-core';

export const wishes = pgTable('wishes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  message: text('message').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
}, table => [index('idx_wishes_created_at').on(table.createdAt)]);

export const weddingSettings = pgTable('wedding_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const rsvps = pgTable('rsvps', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  attendance: text('attendance').notNull(),
  guests: integer('guests').notNull(),
  children: integer('children').notNull().default(0),
  accessNeeds: text('access_needs').notNull().default(''),
  guestNames: text('guest_names').notNull(),
  dietary: text('dietary').notNull(),
  song: text('song').notNull(),
  note: text('note').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
}, table => [index('idx_rsvps_created_at').on(table.createdAt)]);

export const loginAttempts = pgTable('login_attempts', {
  key: text('key').primaryKey(),
  windowStart: bigint('window_start', { mode: 'number' }).notNull(),
  attempts: integer('attempts').notNull().default(0),
});
