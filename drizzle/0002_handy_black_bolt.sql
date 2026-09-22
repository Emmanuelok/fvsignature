ALTER TABLE `rsvps` ADD `children` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `rsvps` ADD `access_needs` text DEFAULT '' NOT NULL;