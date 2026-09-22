CREATE TABLE `rsvps` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`attendance` text NOT NULL,
	`guests` integer NOT NULL,
	`guest_names` text NOT NULL,
	`dietary` text NOT NULL,
	`song` text NOT NULL,
	`note` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rsvps_created_at` ON `rsvps` (`created_at`);--> statement-breakpoint
CREATE TABLE `wedding_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
