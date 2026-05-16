CREATE TABLE `partners` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`stripe_coupon_id` text,
	`discount_type` text DEFAULT 'percent' NOT NULL,
	`discount_value` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`signup_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partners_code_unique` ON `partners` (`code`);--> statement-breakpoint
ALTER TABLE `tenants` ADD `plan` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `stripe_customer_id` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `stripe_subscription_id` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `subscription_status` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `current_period_end` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `referred_by` integer REFERENCES partners(id);--> statement-breakpoint
ALTER TABLE `tenants` ADD `layout_config` text;