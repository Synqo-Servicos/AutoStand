CREATE TABLE "payable_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"payable_id" integer NOT NULL,
	"transaction_id" integer,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"size" integer,
	"mime_type" text,
	"uploaded_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payables" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"type" text NOT NULL,
	"category" text,
	"description" text,
	"supplier" text,
	"amount_cents" integer,
	"frequency" text NOT NULL,
	"first_due_date" text NOT NULL,
	"installments" integer,
	"payment_method" text,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sent_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"kind" text NOT NULL,
	"ref_key" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "payable_id" integer;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "due_date" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "payable_attachments" ADD CONSTRAINT "payable_attachments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payable_attachments" ADD CONSTRAINT "payable_attachments_payable_id_payables_id_fk" FOREIGN KEY ("payable_id") REFERENCES "public"."payables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payable_attachments" ADD CONSTRAINT "payable_attachments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payable_attachments" ADD CONSTRAINT "payable_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payables" ADD CONSTRAINT "payables_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sent_notifications" ADD CONSTRAINT "sent_notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_payable_att_tenant_payable" ON "payable_attachments" USING btree ("tenant_id","payable_id");--> statement-breakpoint
CREATE INDEX "idx_payables_tenant_active" ON "payables" USING btree ("tenant_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_sent_notif" ON "sent_notifications" USING btree ("tenant_id","kind","ref_key");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payable_id_payables_id_fk" FOREIGN KEY ("payable_id") REFERENCES "public"."payables"("id") ON DELETE set null ON UPDATE no action;