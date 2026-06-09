CREATE TABLE `coupons` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `code` text NOT NULL,
  `description` text,
  `discount_type` text NOT NULL,
  `discount_value` integer,
  `max_uses` integer NOT NULL DEFAULT 1,
  `used_count` integer NOT NULL DEFAULT 0,
  `expires_at` text,
  `created_by` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `partner_id` integer REFERENCES `partners`(`id`) ON DELETE SET NULL,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX `coupons_code_unique` ON `coupons` (`code`);

ALTER TABLE `tenants` ADD `coupon_id` integer REFERENCES `coupons`(`id`) ON DELETE SET NULL;
