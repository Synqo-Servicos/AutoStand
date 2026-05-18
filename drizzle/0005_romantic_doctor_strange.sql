CREATE TABLE `demand_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer,
	`event_type` text NOT NULL,
	`brand` text,
	`model` text,
	`body_type` text,
	`fuel` text,
	`transmission` text,
	`city` text,
	`price` integer,
	`year_min` integer,
	`search_term` text,
	`vehicle_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE set null
);
