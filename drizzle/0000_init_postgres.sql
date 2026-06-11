CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"discount_type" text NOT NULL,
	"discount_value" integer,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" text,
	"created_by" integer NOT NULL,
	"partner_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "demand_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"event_type" text NOT NULL,
	"brand" text,
	"model" text,
	"body_type" text,
	"fuel" text,
	"transmission" text,
	"city" text,
	"price" integer,
	"year_min" integer,
	"search_term" text,
	"vehicle_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"vehicle_id" integer,
	"message" text,
	"source" text DEFAULT 'site' NOT NULL,
	"status" text DEFAULT 'novo' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"discount_type" text DEFAULT 'percent' NOT NULL,
	"discount_value" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"signup_count" integer DEFAULT 0 NOT NULL,
	"max_uses" integer,
	"expires_at" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "partners_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sellers" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"document" text,
	"photo_url" text,
	"commission_pct" integer,
	"commission_fixed_cents" integer,
	"status" text DEFAULT 'ativo' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_about_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"icon_slug" text DEFAULT 'ShieldCheck' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"custom_domain" text,
	"status" text DEFAULT 'active' NOT NULL,
	"whatsapp_number" text,
	"instagram_url" text,
	"facebook_url" text,
	"youtube_url" text,
	"tiktok_url" text,
	"twitter_url" text,
	"business_hours" text,
	"contact_email" text,
	"address" text,
	"city" text,
	"primary_color" text DEFAULT '#1E293B' NOT NULL,
	"accent_color" text DEFAULT '#DC2626' NOT NULL,
	"accent_dark_color" text DEFAULT '#B91C1C' NOT NULL,
	"logo_url" text,
	"hero_title" text,
	"hero_subtitle" text,
	"slogan" text,
	"about_heading" text,
	"contact_cta_title" text,
	"contact_cta_body" text,
	"plan" text,
	"mp_subscription_id" text,
	"subscription_status" text,
	"current_period_end" text,
	"referred_by" integer,
	"layout_config" jsonb,
	"marketplace_opt_in" boolean DEFAULT false NOT NULL,
	"partner_banks" jsonb DEFAULT '[]'::jsonb,
	"coupon_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug"),
	CONSTRAINT "tenants_custom_domain_unique" UNIQUE("custom_domain")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"vehicle_id" integer,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"date" text NOT NULL,
	"category" text,
	"seller_id" integer,
	"buyer_name" text,
	"buyer_phone" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'tenant_admin' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vehicle_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"vehicle_id" integer NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'outros' NOT NULL,
	"url" text NOT NULL,
	"size" integer,
	"mime_type" text,
	"uploaded_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"vehicle_id" integer NOT NULL,
	"url" text NOT NULL,
	"order_idx" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"version" text,
	"year" integer NOT NULL,
	"year_manufacture" integer,
	"km" integer NOT NULL,
	"cost_price" integer NOT NULL,
	"sale_price" integer NOT NULL,
	"transmission" text DEFAULT 'automatico' NOT NULL,
	"fuel" text DEFAULT 'flex' NOT NULL,
	"color" text NOT NULL,
	"doors" integer DEFAULT 4 NOT NULL,
	"body_type" text,
	"condition" text DEFAULT 'seminovo' NOT NULL,
	"optionals" jsonb,
	"armored" boolean DEFAULT false NOT NULL,
	"single_owner" boolean DEFAULT false NOT NULL,
	"plate" text,
	"fipe_code" text,
	"description" text,
	"status" text DEFAULT 'disponivel' NOT NULL,
	"primary_photo_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_events" ADD CONSTRAINT "demand_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_about_items" ADD CONSTRAINT "tenant_about_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_referred_by_partners_id_fk" FOREIGN KEY ("referred_by") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_demand_tenant_created" ON "demand_events" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_demand_type_created" ON "demand_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "idx_leads_tenant_status" ON "leads" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_leads_tenant_created" ON "leads" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_sellers_tenant_status" ON "sellers" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_about_tenant_position" ON "tenant_about_items" USING btree ("tenant_id","position");--> statement-breakpoint
CREATE INDEX "idx_tx_tenant_date" ON "transactions" USING btree ("tenant_id","date");--> statement-breakpoint
CREATE INDEX "idx_tx_tenant_type" ON "transactions" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE INDEX "idx_docs_tenant_vehicle" ON "vehicle_documents" USING btree ("tenant_id","vehicle_id");--> statement-breakpoint
CREATE INDEX "idx_photos_tenant_vehicle" ON "vehicle_photos" USING btree ("tenant_id","vehicle_id");--> statement-breakpoint
CREATE INDEX "idx_vehicles_tenant_status" ON "vehicles" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_vehicles_tenant_updated" ON "vehicles" USING btree ("tenant_id","updated_at");