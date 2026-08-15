CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"tenant_name" text NOT NULL,
	"tenant_document" text,
	"plan" text,
	"mp_payment_id" text NOT NULL,
	"mp_preapproval_id" text,
	"gross_cents" integer NOT NULL,
	"fee_cents" integer,
	"net_cents" integer,
	"status" text NOT NULL,
	"paid_at" timestamp NOT NULL,
	"coupon_id" integer,
	"nfse_issued_at" timestamp,
	"nfse_number" text,
	"nfse_issued_by" integer,
	"incomplete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_nfse_issued_by_users_id_fk" FOREIGN KEY ("nfse_issued_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_payments_mp_id" ON "payments" USING btree ("mp_payment_id");--> statement-breakpoint
CREATE INDEX "idx_payments_paid_at" ON "payments" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "idx_payments_tenant" ON "payments" USING btree ("tenant_id");