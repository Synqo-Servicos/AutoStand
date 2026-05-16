CREATE TABLE `leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`vehicle_id` integer,
	`message` text,
	`source` text DEFAULT 'site' NOT NULL,
	`status` text DEFAULT 'novo' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`custom_domain` text,
	`status` text DEFAULT 'active' NOT NULL,
	`whatsapp_number` text,
	`instagram_url` text,
	`business_hours` text,
	`contact_email` text,
	`city` text,
	`primary_color` text DEFAULT '#1E293B' NOT NULL,
	`accent_color` text DEFAULT '#DC2626' NOT NULL,
	`accent_dark_color` text DEFAULT '#B91C1C' NOT NULL,
	`logo_url` text,
	`hero_title` text,
	`hero_subtitle` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_custom_domain_unique` ON `tenants` (`custom_domain`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`vehicle_id` integer NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`buyer_name` text,
	`buyer_phone` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'tenant_admin' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `vehicle_photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`vehicle_id` integer NOT NULL,
	`url` text NOT NULL,
	`order_idx` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`brand` text NOT NULL,
	`model` text NOT NULL,
	`year` integer NOT NULL,
	`km` integer NOT NULL,
	`cost_price` integer NOT NULL,
	`sale_price` integer NOT NULL,
	`transmission` text DEFAULT 'automatico' NOT NULL,
	`fuel` text DEFAULT 'flex' NOT NULL,
	`color` text NOT NULL,
	`doors` integer DEFAULT 4 NOT NULL,
	`description` text,
	`status` text DEFAULT 'disponivel' NOT NULL,
	`primary_photo_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
