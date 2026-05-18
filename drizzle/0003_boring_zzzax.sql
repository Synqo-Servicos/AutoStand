ALTER TABLE `vehicles` ADD `version` text;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `year_manufacture` integer;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `body_type` text;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `condition` text DEFAULT 'seminovo' NOT NULL;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `optionals` text;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `armored` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `single_owner` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `fipe_code` text;--> statement-breakpoint
UPDATE `vehicles` SET `year_manufacture` = `year` WHERE `year_manufacture` IS NULL;