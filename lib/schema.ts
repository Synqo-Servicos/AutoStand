import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
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

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
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
  facebook_url: text("facebook_url"),
  youtube_url: text("youtube_url"),
  tiktok_url: text("tiktok_url"),
  twitter_url: text("twitter_url"),
  business_hours: text("business_hours"),
  contact_email: text("contact_email"),
  address: text("address"),
  city: text("city"),
  primary_color: text("primary_color").notNull().default("#1E293B"),
  accent_color: text("accent_color").notNull().default("#DC2626"),
  accent_dark_color: text("accent_dark_color").notNull().default("#B91C1C"),
  logo_url: text("logo_url"),
  hero_title: text("hero_title"),
  hero_subtitle: text("hero_subtitle"),
  /** Frase curta acima do título do hero (ex.: "Seu próximo carro em Brasília"). */
  slogan: text("slogan"),
  /** Override editorial do "Por que {nome}?" — fallback usa tenant.name. */
  about_heading: text("about_heading"),
  /** Título do bloco final ("Pronto para comprar?"). Null = default. */
  contact_cta_title: text("contact_cta_title"),
  /** Subtítulo do bloco final. Null = default. */
  contact_cta_body: text("contact_cta_body"),

  // Billing. Null em tenants provisionados manualmente pelo super-admin.
  plan: text("plan"), // PlanSlug — 'basico' | 'pro' | 'premium'
  /** ID da assinatura Mercado Pago (Preapproval). */
  mp_subscription_id: text("mp_subscription_id"),
  /** 'incomplete' | 'processing' | 'active' | 'past_due' | 'cancelled' (grafia usada em MP_STATUS_MAP; 'processing' = claim transitório do checkout, ver claimTenantForCheckout) */
  subscription_status: text("subscription_status"),
  current_period_end: text("current_period_end"),
  /** Parceiro de origem da assinatura (atribuição). */
  referred_by: integer("referred_by").references(() => partners.id, { onDelete: "set null" }),

  /** Customização de layout (Fase 4). JSON; null = usar DEFAULT_LAYOUT_CONFIG. */
  layout_config: jsonb("layout_config").$type<LayoutConfig>(),

  /** Concessionária optou por aparecer no marketplace AutoStand. */
  marketplace_opt_in: boolean("marketplace_opt_in")
    .notNull()
    .default(false),

  /** Bancos parceiros — slugs de `lib/banks.ts`. Logos aparecem no site público. */
  partner_banks: jsonb("partner_banks").$type<string[]>().default([]),

  /** Cupom de desconto aplicado na assinatura. */
  coupon_id: integer("coupon_id").references(() => coupons.id, { onDelete: "set null" }),

  created_at: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
});

// --- Users (staff only — no consumer accounts) ---

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  /** Null for super_admin (platform owner); set for tenant staff. */
  tenant_id: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  /** 'super_admin' | 'tenant_admin' */
  role: text("role").notNull().default("tenant_admin"),
  /** Senha provisória → força troca no 1º login (admin provisionado pelo super-admin). */
  must_change_password: boolean("must_change_password").notNull().default(false),
  /** Tutorial de primeiros passos já concluído/dispensado. */
  onboarding_completed: boolean("onboarding_completed").notNull().default(false),
  created_at: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});

// --- Tenant about items (CRUD da seção "Sobre" do storefront) ---

export const tenant_about_items = pgTable("tenant_about_items", {
  id: serial("id").primaryKey(),
  tenant_id: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  /** Posição na grade (0..N-1). order_idx é o nome canonico no projeto. */
  position: integer("position").notNull().default(0),
  /** Slug de ícone Lucide — limitado por allowlist em zod (ver lib/schemas). */
  icon_slug: text("icon_slug").notNull().default("ShieldCheck"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  created_at: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => ({
  byTenantPosition: index("idx_about_tenant_position").on(table.tenant_id, table.position),
}));

// --- Vehicles ---

export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
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
  optionals: jsonb("optionals").$type<string[]>(),
  /** Blindado. */
  armored: boolean("armored").notNull().default(false),
  /** Único dono — argumento de venda exibido no post. */
  single_owner: boolean("single_owner").notNull().default(false),
  /** Placa Mercosul/antiga. Permite consulta automática de dados. */
  plate: text("plate"),
  /** Código FIPE — ajuda a casar com a taxonomia dos portais. */
  fipe_code: text("fipe_code"),
  description: text("description"),
  status: text("status").notNull().default("disponivel"),
  primary_photo_url: text("primary_photo_url"),
  created_at: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => ({
  // Listagens do admin filtram por (tenant_id, status) e ordenam por
  // updated_at. Sem índice, cada chamada do dashboard/listagem é
  // table-scan + filter proporcional ao total de veículos da plataforma.
  byTenantStatus: index("idx_vehicles_tenant_status").on(table.tenant_id, table.status),
  byTenantUpdated: index("idx_vehicles_tenant_updated").on(table.tenant_id, table.updated_at),
}));

// --- Vehicle photos ---

export const vehicle_photos = pgTable("vehicle_photos", {
  id: serial("id").primaryKey(),
  tenant_id: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  vehicle_id: integer("vehicle_id")
    .notNull()
    .references(() => vehicles.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  order_idx: integer("order_idx").notNull().default(0),
  created_at: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => ({
  // Toda leitura é "fotos do veículo X do tenant Y, ordem N".
  byTenantVehicle: index("idx_photos_tenant_vehicle").on(table.tenant_id, table.vehicle_id),
}));

// --- Vehicle documents (anexos do estoque — controle interno) ---

export const vehicle_documents = pgTable("vehicle_documents", {
  id: serial("id").primaryKey(),
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
  /** URL no S3 (servida via CloudFront; público mas não-indexado — hash não adivinhável). */
  url: text("url").notNull(),
  /** Tamanho em bytes — exibido na UI. */
  size: integer("size"),
  /** Mime type — define o ícone. */
  mime_type: text("mime_type"),
  /** Usuário que fez o upload. */
  uploaded_by: integer("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  created_at: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => ({
  byTenantVehicle: index("idx_docs_tenant_vehicle").on(table.tenant_id, table.vehicle_id),
}));

// --- Transactions ---

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  tenant_id: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  /**
   * Veículo associado. Obrigatório para 'entrada' (compra) e 'saida' (venda).
   * NULL para despesas operacionais não-atreladas (aluguel, energia, etc.).
   */
  vehicle_id: integer("vehicle_id").references(() => vehicles.id, { onDelete: "cascade" }),
  /**
   * 'entrada'         — compra de veículo p/ estoque (exige vehicle_id)
   * 'saida'           — venda de veículo (exige vehicle_id)
   * 'despesa_direta'  — custo atrelado a um veículo (preparação, laudo, NF de peça)
   * 'despesa_fixa'    — custo recorrente da loja (aluguel, salário, etc.)
   * 'despesa_var'     — custo eventual da loja (marketing, manutenção)
   * 'comissao'        — comissão de vendedor sobre uma venda
   */
  type: text("type").notNull(),
  amount: integer("amount").notNull(),
  date: text("date").notNull(),
  /** Subcategoria livre (Aluguel, Energia, Polimento, Despachante…). */
  category: text("category"),
  /** Vendedor responsável — preenchido em 'saida' e 'comissao'. */
  seller_id: integer("seller_id").references(() => sellers.id, { onDelete: "set null" }),
  buyer_name: text("buyer_name"),
  buyer_phone: text("buyer_phone"),
  notes: text("notes"),
  created_at: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => ({
  // Relatório financeiro filtra por (tenant_id, date) num intervalo.
  byTenantDate: index("idx_tx_tenant_date").on(table.tenant_id, table.date),
  // Algumas consultas filtram por tipo (vendas, comissões, etc.).
  byTenantType: index("idx_tx_tenant_type").on(table.tenant_id, table.type),
}));

// --- Sellers (vendedores da concessionária) ---

export const sellers = pgTable("sellers", {
  id: serial("id").primaryKey(),
  tenant_id: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  /** CPF (sem máscara). */
  document: text("document"),
  /** Foto opcional pra cards do dashboard. */
  photo_url: text("photo_url"),
  /** Comissão em centésimos de % (basis points): 300 = 3%. Alternativa à fixa. */
  commission_pct: integer("commission_pct"),
  /** Comissão fixa em centavos (alternativa ao %). */
  commission_fixed_cents: integer("commission_fixed_cents"),
  /** 'ativo' | 'desligado' */
  status: text("status").notNull().default("ativo"),
  created_at: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => ({
  byTenantStatus: index("idx_sellers_tenant_status").on(table.tenant_id, table.status),
}));

// --- Leads (lightweight CRM — feeds email/WhatsApp campaigns) ---

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
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
  created_at: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => ({
  // Kanban do CRM filtra por status; timeline ordena por created_at desc.
  byTenantStatus: index("idx_leads_tenant_status").on(table.tenant_id, table.status),
  byTenantCreated: index("idx_leads_tenant_created").on(table.tenant_id, table.created_at),
}));

// --- Lead interactions (histórico de contato — timeline por lead) ---

export const lead_interactions = pgTable("lead_interactions", {
  id: serial("id").primaryKey(),
  tenant_id: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  lead_id: integer("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  /** Quem registrou; null = sistema/automação (ex.: mudança de estágio). */
  user_id: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  /** 'nota' | 'ligacao' | 'whatsapp' | 'email' | 'visita' | 'proposta' | 'mudanca_status' */
  type: text("type").notNull(),
  /** Texto livre da interação (nota, resumo). Pode ser null em eventos. */
  body: text("body"),
  /** Dados estruturados do evento — ex.: { from, to } na mudança de estágio. */
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  created_at: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => ({
  byTenantLead: index("idx_lead_interactions_tenant_lead").on(
    table.tenant_id, table.lead_id, table.created_at,
  ),
}));

// --- Partners (links de desconto / atribuição) ---

export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  /** Código usado no link de cadastro: ?parceiro=CODE */
  code: text("code").notNull().unique(),
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
  created_at: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});

// --- Coupons (sistema de cupons de desconto) ---

export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description"),
  /** 'percentage' | 'fixed' | 'free_month' */
  discount_type: text("discount_type").notNull(),
  /** Null para free_month. Percentual inteiro (ex: 10) ou centavos (ex: 5000 = R$50). */
  discount_value: integer("discount_value"),
  max_uses: integer("max_uses").notNull().default(1),
  used_count: integer("used_count").notNull().default(0),
  expires_at: text("expires_at"),
  /** FK para users.id — sem .references() para evitar referência circular tenants→coupons→users→tenants. */
  created_by: integer("created_by").notNull(),
  partner_id: integer("partner_id").references(() => partners.id, { onDelete: "set null" }),
  created_at: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});

// --- Demand events (inteligência de demanda — eventos anônimos) ---

export const demand_events = pgTable("demand_events", {
  id: serial("id").primaryKey(),
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
  created_at: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => ({
  // Inteligência de demanda agrega por janela temporal e tipo de evento.
  byTenantCreated: index("idx_demand_tenant_created").on(table.tenant_id, table.created_at),
  byTypeCreated: index("idx_demand_type_created").on(table.event_type, table.created_at),
}));

export type TenantRow = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type UserRow = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type VehicleRow = typeof vehicles.$inferSelect;
export type VehiclePhotoRow = typeof vehicle_photos.$inferSelect;
export type VehicleDocumentRow = typeof vehicle_documents.$inferSelect;
export type NewVehicleDocument = typeof vehicle_documents.$inferInsert;
export type TransactionRow = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type SellerRow = typeof sellers.$inferSelect;
export type NewSeller = typeof sellers.$inferInsert;
export type LeadRow = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadInteractionRow = typeof lead_interactions.$inferSelect;
export type NewLeadInteraction = typeof lead_interactions.$inferInsert;
export type PartnerRow = typeof partners.$inferSelect;
export type NewPartner = typeof partners.$inferInsert;
export type DemandEventRow = typeof demand_events.$inferSelect;
export type NewDemandEvent = typeof demand_events.$inferInsert;
export type TenantAboutItemRow = typeof tenant_about_items.$inferSelect;
export type NewTenantAboutItem = typeof tenant_about_items.$inferInsert;
export type CouponRow = typeof coupons.$inferSelect;
export type NewCoupon = typeof coupons.$inferInsert;
