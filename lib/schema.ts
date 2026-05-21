import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { LayoutConfig } from "./layout";

/**
 * Multi-tenant schema for the whitelabel dealership platform.
 *
 * Tenancy model: shared database, every domain row carries `tenant_id`.
 * Tenant resolution happens by `Host` header in middleware.
 *
 * JS property names are kept in snake_case to match the column names and the
 * pre-existing frontend types (Vehicle, Transaction, ...).
 */

// --- Tenants (dealership clients) ---

export const tenants = sqliteTable("tenants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Stable identifier — used for the platform subdomain and dev override. */
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  /** The dealership's own domain. Null until configured. */
  custom_domain: text("custom_domain").unique(),
  /** 'active' | 'suspended' */
  status: text("status").notNull().default("active"),

  // Branding / contact (replaces the old hardcoded lib/constants.ts values)
  whatsapp_number: text("whatsapp_number"),
  instagram_url: text("instagram_url"),
  business_hours: text("business_hours"),
  contact_email: text("contact_email"),
  city: text("city"),
  primary_color: text("primary_color").notNull().default("#1E293B"),
  accent_color: text("accent_color").notNull().default("#DC2626"),
  accent_dark_color: text("accent_dark_color").notNull().default("#B91C1C"),
  logo_url: text("logo_url"),
  hero_title: text("hero_title"),
  hero_subtitle: text("hero_subtitle"),

  // Billing (Stripe). Null em tenants provisionados manualmente pelo super-admin.
  plan: text("plan"), // PlanSlug — 'basico' | 'pro' | 'premium'
  stripe_customer_id: text("stripe_customer_id"),
  stripe_subscription_id: text("stripe_subscription_id"),
  /** 'incomplete' | 'active' | 'past_due' | 'canceled' */
  subscription_status: text("subscription_status"),
  current_period_end: text("current_period_end"),
  /** Parceiro de origem da assinatura (atribuição). */
  referred_by: integer("referred_by").references(() => partners.id, { onDelete: "set null" }),

  /** Customização de layout (Fase 4). JSON; null = usar DEFAULT_LAYOUT_CONFIG. */
  layout_config: text("layout_config", { mode: "json" }).$type<LayoutConfig>(),

  /** Concessionária optou por aparecer no marketplace AutoStand. */
  marketplace_opt_in: integer("marketplace_opt_in", { mode: "boolean" })
    .notNull()
    .default(false),

  /** Bancos parceiros — slugs de `lib/banks.ts`. Logos aparecem no site público. */
  partner_banks: text("partner_banks", { mode: "json" }).$type<string[]>().default([]),

  created_at: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// --- Users (staff only — no consumer accounts) ---

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Null for super_admin (platform owner); set for tenant staff. */
  tenant_id: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  /** 'super_admin' | 'tenant_admin' */
  role: text("role").notNull().default("tenant_admin"),
  created_at: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// --- Vehicles ---

export const vehicles = sqliteTable("vehicles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenant_id: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  /** Versão/trim — ex.: "1.0 Turbo GT". Necessário para feed de portal e post. */
  version: text("version"),
  /** Ano modelo. */
  year: integer("year").notNull(),
  /** Ano de fabricação. Brasil anuncia fab/modelo; null = igual ao ano modelo. */
  year_manufacture: integer("year_manufacture"),
  km: integer("km").notNull(),
  cost_price: integer("cost_price").notNull(),
  sale_price: integer("sale_price").notNull(),
  transmission: text("transmission").notNull().default("automatico"),
  fuel: text("fuel").notNull().default("flex"),
  color: text("color").notNull(),
  doors: integer("doors").notNull().default(4),
  /** Carroceria — 'hatch' | 'sedan' | 'suv' | 'picape' | 'minivan' | ... */
  body_type: text("body_type"),
  /** 'novo' | 'seminovo' | 'usado' */
  condition: text("condition").notNull().default("seminovo"),
  /** Opcionais — JSON array de strings (ar-condicionado, multimídia, ...). */
  optionals: text("optionals", { mode: "json" }).$type<string[]>(),
  /** Blindado. */
  armored: integer("armored", { mode: "boolean" }).notNull().default(false),
  /** Único dono — argumento de venda exibido no post. */
  single_owner: integer("single_owner", { mode: "boolean" }).notNull().default(false),
  /** Placa Mercosul/antiga. Permite consulta automática de dados. */
  plate: text("plate"),
  /** Código FIPE — ajuda a casar com a taxonomia dos portais. */
  fipe_code: text("fipe_code"),
  description: text("description"),
  status: text("status").notNull().default("disponivel"),
  primary_photo_url: text("primary_photo_url"),
  created_at: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// --- Vehicle photos ---

export const vehicle_photos = sqliteTable("vehicle_photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenant_id: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  vehicle_id: integer("vehicle_id")
    .notNull()
    .references(() => vehicles.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  order_idx: integer("order_idx").notNull().default(0),
  created_at: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// --- Vehicle documents (anexos do estoque — controle interno) ---

export const vehicle_documents = sqliteTable("vehicle_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenant_id: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  vehicle_id: integer("vehicle_id")
    .notNull()
    .references(() => vehicles.id, { onDelete: "cascade" }),
  /** Nome de exibição (ex.: "CRLV 2026", "Laudo Cautelar Sertec"). */
  name: text("name").notNull(),
  /** 'crlv' | 'laudo' | 'dut' | 'nf_peca' | 'os' | 'contrato' | 'historico' | 'outros' */
  category: text("category").notNull().default("outros"),
  /** URL no Vercel Blob (público mas não-indexado — hash não adivinhável). */
  url: text("url").notNull(),
  /** Tamanho em bytes — exibido na UI. */
  size: integer("size"),
  /** Mime type — define o ícone. */
  mime_type: text("mime_type"),
  /** Usuário que fez o upload. */
  uploaded_by: integer("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  created_at: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// --- Transactions ---

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenant_id: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  vehicle_id: integer("vehicle_id")
    .notNull()
    .references(() => vehicles.id, { onDelete: "cascade" }),
  /** 'entrada' | 'saida' */
  type: text("type").notNull(),
  amount: integer("amount").notNull(),
  date: text("date").notNull(),
  buyer_name: text("buyer_name"),
  buyer_phone: text("buyer_phone"),
  notes: text("notes"),
  created_at: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// --- Leads (lightweight CRM — feeds email/WhatsApp campaigns) ---

export const leads = sqliteTable("leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenant_id: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  /** Vehicle the lead showed interest in, if any. */
  vehicle_id: integer("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
  message: text("message"),
  /** 'site' | 'whatsapp' | 'manual' */
  source: text("source").notNull().default("site"),
  /** 'novo' | 'contatado' | 'negociando' | 'convertido' | 'perdido' */
  status: text("status").notNull().default("novo"),
  created_at: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// --- Partners (links de desconto / atribuição) ---

export const partners = sqliteTable("partners", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  /** Código usado no link de cadastro: ?parceiro=CODE */
  code: text("code").notNull().unique(),
  /** Cupom correspondente no Stripe. */
  stripe_coupon_id: text("stripe_coupon_id"),
  /** 'percent' | 'amount' */
  discount_type: text("discount_type").notNull().default("percent"),
  /** Percentual (ex.: 15) ou valor em centavos, conforme discount_type. */
  discount_value: integer("discount_value").notNull().default(0),
  /** 'active' | 'inactive' */
  status: text("status").notNull().default("active"),
  /** Quantas concessionárias se cadastraram por este parceiro. */
  signup_count: integer("signup_count").notNull().default(0),
  /** Limite de cadastros pelo código. Null = ilimitado. */
  max_uses: integer("max_uses"),
  /** Validade do código (data ISO YYYY-MM-DD). Null = sem validade. */
  expires_at: text("expires_at"),
  created_at: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// --- Demand events (inteligência de demanda — eventos anônimos) ---

export const demand_events = sqliteTable("demand_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Loja onde o evento ocorreu. Null = busca no marketplace AutoStand. */
  tenant_id: integer("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  /** 'search' | 'view' */
  event_type: text("event_type").notNull(),
  brand: text("brand"),
  model: text("model"),
  body_type: text("body_type"),
  fuel: text("fuel"),
  transmission: text("transmission"),
  city: text("city"),
  /** Centavos. Busca: teto de preço filtrado. Visualização: preço do veículo. */
  price: integer("price"),
  /** Busca: ano mínimo filtrado. */
  year_min: integer("year_min"),
  /** Busca: termo de texto digitado. */
  search_term: text("search_term"),
  /** Visualização: id do veículo visto. */
  vehicle_id: integer("vehicle_id"),
  created_at: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type TenantRow = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type UserRow = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type VehicleRow = typeof vehicles.$inferSelect;
export type VehiclePhotoRow = typeof vehicle_photos.$inferSelect;
export type VehicleDocumentRow = typeof vehicle_documents.$inferSelect;
export type NewVehicleDocument = typeof vehicle_documents.$inferInsert;
export type TransactionRow = typeof transactions.$inferSelect;
export type LeadRow = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type PartnerRow = typeof partners.$inferSelect;
export type NewPartner = typeof partners.$inferInsert;
export type DemandEventRow = typeof demand_events.$inferSelect;
export type NewDemandEvent = typeof demand_events.$inferInsert;
