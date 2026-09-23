-- Preserve existing responses when upgrading an earlier PostgreSQL installation.
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS children INTEGER NOT NULL DEFAULT 0;
-- statement-breakpoint
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS access_needs TEXT NOT NULL DEFAULT '';
