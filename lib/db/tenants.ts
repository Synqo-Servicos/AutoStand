import { and, eq, sql } from "drizzle-orm";
import {
  demand_events, leads, partners, tenants, transactions, users,
  vehicle_documents, vehicle_photos, vehicles,
} from "@/lib/schema";
import type { NewTenant, TenantRow } from "@/lib/schema";
import { db, dbAll, dbGet, type Tx } from "./client";

// — CRUD ———————————————————————————————————————————————————————

export async function getTenantById(id: number): Promise<TenantRow | null> {
  const [row] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return row ?? null;
}

export async function getTenantBySlug(slug: string): Promise<TenantRow | null> {
  const [row] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  return row ?? null;
}

export async function getTenantByDomain(domain: string): Promise<TenantRow | null> {
  const [row] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.custom_domain, domain))
    .limit(1);
  return row ?? null;
}

/**
 * Allowlist dos campos que um UPDATE (PATCH de usuário) pode setar.
 * Bloqueia mass-assignment: campos de billing (subscription_status,
 * mp_subscription_id, current_period_end) ficam DE FORA — só o webhook do
 * Mercado Pago os altera, via setTenantSubscriptionState (update cru).
 */
const TENANT_WRITABLE_FIELDS = [
  "slug", "name", "city", "logo_url", "address", "contact_email",
  "whatsapp_number", "instagram_url", "facebook_url", "youtube_url",
  "tiktok_url", "twitter_url", "business_hours",
  "primary_color", "accent_color", "accent_dark_color",
  "hero_title", "hero_subtitle", "slogan", "about_heading",
  "contact_cta_title", "contact_cta_body",
  "layout_config",
  "custom_domain", "plan", "status", "marketplace_opt_in",
  "partner_banks", "referred_by",
  "coupon_id",
  "document",
] as const;

/**
 * Campos aceitos só na CRIAÇÃO. createTenant é montado server-side (signup),
 * não vem de body de usuário, então pode gravar o estado inicial de billing —
 * que, na allowlist de update, seria (corretamente) descartado.
 */
const TENANT_CREATE_FIELDS = [
  ...TENANT_WRITABLE_FIELDS,
  "subscription_status", "mp_subscription_id", "current_period_end",
  "terms_accepted_at",
] as const;

function pickFields<T extends Record<string, unknown>>(
  input: T,
  allow: readonly string[],
): Partial<T> {
  const safe: Record<string, unknown> = {};
  for (const key of allow) {
    if (key in input) safe[key] = (input as Record<string, unknown>)[key];
  }
  return safe as Partial<T>;
}

/** Filtra input p/ os campos gravaveis num UPDATE (bloqueia billing). */
export function pickWritableTenantFields<T extends Record<string, unknown>>(
  input: T,
): Partial<T> {
  return pickFields(input, TENANT_WRITABLE_FIELDS);
}

/** Filtra input p/ os campos aceitos na CRIAÇÃO (inclui billing inicial). */
export function pickCreatableTenantFields<T extends Record<string, unknown>>(
  input: T,
): Partial<T> {
  return pickFields(input, TENANT_CREATE_FIELDS);
}

export async function createTenant(input: NewTenant, tx?: Tx): Promise<TenantRow> {
  const orm = tx ?? db;
  const safe = pickCreatableTenantFields(input);
  if (!safe.slug || !safe.name) {
    throw new Error("Slug e nome são obrigatórios");
  }
  const [row] = await orm.insert(tenants).values(safe as NewTenant).returning();
  return row;
}

export async function updateTenant(
  id: number,
  input: Partial<NewTenant>,
): Promise<TenantRow | null> {
  const safe = pickWritableTenantFields(input);
  if (Object.keys(safe).length > 0) {
    await db
      .update(tenants)
      .set({ ...safe, updated_at: sql`CURRENT_TIMESTAMP` })
      .where(eq(tenants.id, id));
  }
  return getTenantById(id);
}

/** Status do preapproval do Mercado Pago → estado interno do tenant. */
const MP_STATUS_MAP: Record<string, { subscription_status: string; status: string }> = {
  authorized: { subscription_status: "active",    status: "active" },
  paused:     { subscription_status: "past_due",  status: "suspended" },
  cancelled:  { subscription_status: "cancelled", status: "suspended" },
};

/**
 * Sincroniza o estado de assinatura do tenant a partir de um evento de
 * preapproval do Mercado Pago. Retorna `false` (no-op) se o status do MP
 * não for reconhecido. Centraliza a regra de billing que antes vivia inline
 * na rota do webhook.
 */
export async function setTenantSubscriptionState(
  tenantId: number,
  mpStatus: string,
  mpSubscriptionId: string,
): Promise<boolean> {
  const mapped = MP_STATUS_MAP[mpStatus];
  if (!mapped) return false;
  await db
    .update(tenants)
    .set({ ...mapped, mp_subscription_id: mpSubscriptionId, updated_at: sql`CURRENT_TIMESTAMP` })
    .where(eq(tenants.id, tenantId));
  return true;
}

/**
 * CAS: reivindica atomicamente um tenant `incomplete` para o checkout,
 * marcando-o como `processing`. Retorna true só para o request que venceu a
 * corrida — impede que double-click/retry criem duas assinaturas reais no MP.
 * Mesmo padrão de incrementCouponUse (UPDATE condicional + returning).
 */
export async function claimTenantForCheckout(tenantId: number): Promise<boolean> {
  const rows = await db
    .update(tenants)
    .set({ subscription_status: "processing", updated_at: sql`CURRENT_TIMESTAMP` })
    .where(and(eq(tenants.id, tenantId), eq(tenants.subscription_status, "incomplete")))
    .returning({ id: tenants.id });
  return rows.length > 0;
}

/** Reverte `processing` → `incomplete` quando o pagamento falha, liberando retry. */
export async function releaseTenantCheckout(tenantId: number): Promise<void> {
  await db
    .update(tenants)
    .set({ subscription_status: "incomplete", updated_at: sql`CURRENT_TIMESTAMP` })
    .where(and(eq(tenants.id, tenantId), eq(tenants.subscription_status, "processing")));
}

/**
 * Coleta todas as URLs de blob de um tenant — logo, hero image, fotos de
 * veículos e documentos. Usado antes de deleteTenant pra que o caller
 * possa apagar os arquivos no storage depois que a transação no DB sair.
 */
export async function listTenantBlobUrls(id: number): Promise<string[]> {
  const tenant = await getTenantById(id);
  if (!tenant) return [];

  const [photoUrls, docUrls] = await Promise.all([
    db.select({ url: vehicle_photos.url }).from(vehicle_photos).where(eq(vehicle_photos.tenant_id, id)),
    db.select({ url: vehicle_documents.url }).from(vehicle_documents).where(eq(vehicle_documents.tenant_id, id)),
  ]);

  const urls = [...photoUrls.map((r) => r.url), ...docUrls.map((r) => r.url)];
  if (tenant.logo_url) urls.push(tenant.logo_url);
  const heroUrl = tenant.layout_config?.heroImageUrl ?? null;
  if (heroUrl) urls.push(heroUrl);
  return urls;
}

export async function deleteTenant(id: number): Promise<void> {
  // Remove explicitamente os dados dependentes — não dependemos do cascade
  // do SQLite (a checagem de foreign key pode estar desligada na conexão).
  await db.delete(leads).where(eq(leads.tenant_id, id));
  await db.delete(transactions).where(eq(transactions.tenant_id, id));
  await db.delete(vehicle_documents).where(eq(vehicle_documents.tenant_id, id));
  await db.delete(vehicle_photos).where(eq(vehicle_photos.tenant_id, id));
  await db.delete(vehicles).where(eq(vehicles.tenant_id, id));
  await db.delete(demand_events).where(eq(demand_events.tenant_id, id));
  await db.delete(users).where(eq(users.tenant_id, id));
  await db.delete(tenants).where(eq(tenants.id, id));
}

// — Plataforma / super-admin (cross-tenant) ———————————————————————

export interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalVehicles: number;
  totalLeads: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const byStatus = (await dbAll(sql`
    SELECT status, COUNT(*) as count FROM tenants GROUP BY status
  `)) as { status: string; count: number }[];
  const vehicleCount = (await dbGet(sql`SELECT COUNT(*) as c FROM vehicles`)) as { c: number };
  const leadCount = (await dbGet(sql`SELECT COUNT(*) as c FROM leads`)) as { c: number };

  const active = byStatus.find((r) => r.status === "active")?.count ?? 0;
  const suspended = byStatus.find((r) => r.status === "suspended")?.count ?? 0;

  return {
    totalTenants: active + suspended,
    activeTenants: active,
    suspendedTenants: suspended,
    totalVehicles: vehicleCount?.c ?? 0,
    totalLeads: leadCount?.c ?? 0,
  };
}

export interface TenantWithStats extends TenantRow {
  vehicle_count: number;
  lead_count: number;
}

export async function listTenantsWithStats(): Promise<TenantWithStats[]> {
  return (await dbAll(sql`
    SELECT t.*,
      (SELECT COUNT(*) FROM vehicles v WHERE v.tenant_id = t.id) as vehicle_count,
      (SELECT COUNT(*) FROM leads l WHERE l.tenant_id = t.id) as lead_count
    FROM tenants t
    ORDER BY t.created_at DESC
  `)) as TenantWithStats[];
}

// Re-export pra outros módulos que precisam — não querer expor o helper
// publicamente, mas o partners precisa pra consultar tenants referidos.
export { partners };
