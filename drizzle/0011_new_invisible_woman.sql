CREATE TABLE `tenant_about_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`icon_slug` text DEFAULT 'ShieldCheck' NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_about_tenant_position` ON `tenant_about_items` (`tenant_id`,`position`);--> statement-breakpoint
ALTER TABLE `tenants` ADD `facebook_url` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `youtube_url` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `tiktok_url` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `twitter_url` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `address` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `slogan` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `about_heading` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `contact_cta_title` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `contact_cta_body` text;