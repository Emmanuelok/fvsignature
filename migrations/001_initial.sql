-- PostgreSQL schema. Historical Cloudflare SQLite migrations live in drizzle/.
-- Every statement in this initial migration is safe to run again.
CREATE TABLE IF NOT EXISTS wishes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_wishes_created_at ON wishes (created_at);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS wedding_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS rsvps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  attendance TEXT NOT NULL,
  guests INTEGER NOT NULL,
  children INTEGER NOT NULL DEFAULT 0,
  access_needs TEXT NOT NULL DEFAULT '',
  guest_names TEXT NOT NULL,
  dietary TEXT NOT NULL,
  song TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_rsvps_created_at ON rsvps (created_at);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY,
  window_start BIGINT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
