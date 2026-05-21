CREATE TABLE `sellers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`document` text,
	`photo_url` text,
	`commission_pct` integer,
	`commission_fixed_cents` integer,
	`status` text DEFAULT 'ativo' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`vehicle_id` integer,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`category` text,
	`seller_id` integer,
	`buyer_name` text,
	`buyer_phone` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "tenant_id", "vehicle_id", "type", "amount", "date", "category", "seller_id", "buyer_name", "buyer_phone", "notes", "created_at") SELECT "id", "tenant_id", "vehicle_id", "type", "amount", "date", NULL AS "category", NULL AS "seller_id", "buyer_name", "buyer_phone", "notes", "created_at" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;