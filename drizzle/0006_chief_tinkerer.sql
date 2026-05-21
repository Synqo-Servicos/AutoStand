CREATE TABLE `vehicle_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`vehicle_id` integer NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT 'outros' NOT NULL,
	`url` text NOT NULL,
	`size` integer,
	`mime_type` text,
	`uploaded_by` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
