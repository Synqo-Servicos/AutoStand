ALTER TABLE `partners` DROP COLUMN `stripe_coupon_id`;--> statement-breakpoint
ALTER TABLE `tenants` DROP COLUMN `stripe_customer_id`;--> statement-breakpoint
ALTER TABLE `tenants` DROP COLUMN `stripe_subscription_id`;