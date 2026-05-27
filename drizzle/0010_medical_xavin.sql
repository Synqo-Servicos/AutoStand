CREATE INDEX `idx_demand_tenant_created` ON `demand_events` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_demand_type_created` ON `demand_events` (`event_type`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_leads_tenant_status` ON `leads` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_leads_tenant_created` ON `leads` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_sellers_tenant_status` ON `sellers` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_tx_tenant_date` ON `transactions` (`tenant_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_tx_tenant_type` ON `transactions` (`tenant_id`,`type`);--> statement-breakpoint
CREATE INDEX `idx_docs_tenant_vehicle` ON `vehicle_documents` (`tenant_id`,`vehicle_id`);--> statement-breakpoint
CREATE INDEX `idx_photos_tenant_vehicle` ON `vehicle_photos` (`tenant_id`,`vehicle_id`);--> statement-breakpoint
CREATE INDEX `idx_vehicles_tenant_status` ON `vehicles` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_vehicles_tenant_updated` ON `vehicles` (`tenant_id`,`updated_at`);