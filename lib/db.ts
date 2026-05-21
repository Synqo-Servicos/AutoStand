import { createClient } from "@libsql/client";
import { and, desc, eq, getTableColumns, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/lib/schema";
import type {
  LeadRow,
  NewLead,
  NewPartner,
  NewTenant,
  PartnerRow,
  TenantRow,
  TransactionRow,
  UserRow,
  VehicleRow,
  VehicleDocumentRow,
  VehiclePhotoRow,
} from "@/lib/schema";
import { demand_events, leads, partners, tenants, transactions, users, vehicle_documents, vehicle_photos, vehicles } from "@/lib/schema";
import type { DashboardStats, MonthlyData, StockByStatus } from "@/types/dashboard";
import type { TransactionInput, TransactionWithVehicle } from "@/types/transaction";
import type { VehicleInput, VehicleWithPhotos } from "@/types/vehicle";

// --- Connection ---
// Aceita os nomes do nosso .env (DATABASE_*) e os que a integração Turso da
// Vercel injeta (TURSO_*). Sem nenhum, cai no arquivo local de desenvolvimento.

const client = createClient({
  url: process.env.DATABASE_URL ?? process.env.TURSO_DATABASE_URL ?? "file:local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
export { client };

// --- Tenants (platform-level, not tenant-scoped) ---

export async function listTenants(): Promise<TenantRow[]> {
  return db.select().from(tenants).orderBy(desc(tenants.created_at));
}

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

export async function createTenant(input: NewTenant): Promise<TenantRow> {
  const [row] = await db.insert(tenants).values(input).returning();
  return row;
}

export async function updateTenant(
  id: number,
  input: Partial<NewTenant>,
): Promise<TenantRow | null> {
  const { id: _omit, created_at: _omit2, ...safe } = input;
  void _omit;
  void _omit2;
  if (Object.keys(safe).length > 0) {
    await db
      .update(tenants)
      .set({ ...safe, updated_at: sql`CURRENT_TIMESTAMP` })
      .where(eq(tenants.id, id));
  }
  return getTenantById(id);
}

export async function deleteTenant(id: number): Promise<void> {
  // Remove explicitamente os dados dependentes — não dependemos do cascade
  // do SQLite (a checagem de foreign key pode estar desligada na conexão).
  await db.delete(leads).where(eq(leads.tenant_id, id));
  await db.delete(transactions).where(eq(transactions.tenant_id, id));
  await db.delete(vehicle_photos).where(eq(vehicle_photos.tenant_id, id));
  await db.delete(vehicles).where(eq(vehicles.tenant_id, id));
  await db.delete(demand_events).where(eq(demand_events.tenant_id, id));
  await db.delete(users).where(eq(users.tenant_id, id));
  await db.delete(tenants).where(eq(tenants.id, id));
}

// --- Users (platform-level — auth looks up globally by email) ---

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row ?? null;
}

export async function getUserById(id: number): Promise<UserRow | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function listUsersByTenant(tenantId: number): Promise<UserRow[]> {
  return db.select().from(users).where(eq(users.tenant_id, tenantId));
}

export async function createUser(input: {
  email: string;
  password: string;
  name: string;
  role?: string;
  tenant_id?: number | null;
}): Promise<UserRow> {
  const [row] = await db
    .insert(users)
    .values({
      email: input.email,
      password: input.password,
      name: input.name,
      role: input.role ?? "tenant_admin",
      tenant_id: input.tenant_id ?? null,
    })
    .returning();
  return row;
}

// --- Vehicles (tenant-scoped) ---

export interface VehicleFilters {
  status?: string;
  brand?: string;
  fuel?: string;
  transmission?: string;
  year_min?: number;
  year_max?: number;
  km_max?: number;
  price_min?: number;
  price_max?: number;
  search?: string;
}

export async function listVehicles(
  tenantId: number,
  filters: VehicleFilters = {},
): Promise<VehicleRow[]> {
  const conditions = [eq(vehicles.tenant_id, tenantId)];

  if (filters.status) conditions.push(eq(vehicles.status, filters.status));
  if (filters.brand) conditions.push(eq(vehicles.brand, filters.brand));
  if (filters.fuel) conditions.push(eq(vehicles.fuel, filters.fuel));
  if (filters.transmission) conditions.push(eq(vehicles.transmission, filters.transmission));
  if (filters.year_min) conditions.push(sql`${vehicles.year} >= ${filters.year_min}`);
  if (filters.year_max) conditions.push(sql`${vehicles.year} <= ${filters.year_max}`);
  if (filters.km_max) conditions.push(sql`${vehicles.km} <= ${filters.km_max}`);
  if (filters.price_min) conditions.push(sql`${vehicles.sale_price} >= ${filters.price_min}`);
  if (filters.price_max) conditions.push(sql`${vehicles.sale_price} <= ${filters.price_max}`);
  if (filters.search) {
    conditions.push(
      sql`(${vehicles.brand} LIKE ${`%${filters.search}%`} OR ${vehicles.model} LIKE ${`%${filters.search}%`})`,
    );
  }

  return db
    .select()
    .from(vehicles)
    .where(and(...conditions))
    .orderBy(desc(vehicles.created_at));
}

export async function getVehicle(tenantId: number, id: number): Promise<VehicleRow | null> {
  const [row] = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.tenant_id, tenantId), eq(vehicles.id, id)))
    .limit(1);
  return row ?? null;
}

export async function getVehicleWithPhotos(
  tenantId: number,
  id: number,
): Promise<VehicleWithPhotos | null> {
  const vehicle = await getVehicle(tenantId, id);
  if (!vehicle) return null;
  const photos = await getPhotosByVehicle(tenantId, id);
  return { ...vehicle, photos };
}

export async function createVehicle(
  tenantId: number,
  input: VehicleInput,
): Promise<VehicleRow> {
  const [row] = await db
    .insert(vehicles)
    .values({ ...input, tenant_id: tenantId })
    .returning();
  return row;
}

const VEHICLE_UPDATE_FIELDS = [
  "brand", "model", "version", "year", "year_manufacture", "km",
  "cost_price", "sale_price", "transmission", "fuel", "color", "doors",
  "body_type", "condition", "optionals", "armored", "single_owner",
  "fipe_code", "plate", "description", "status", "primary_photo_url",
] as const;

export async function updateVehicle(
  tenantId: number,
  id: number,
  input: Partial<VehicleInput>,
): Promise<VehicleRow | null> {
  const safe: Record<string, unknown> = {};
  for (const key of VEHICLE_UPDATE_FIELDS) {
    if (key in input) safe[key] = input[key];
  }
  if (Object.keys(safe).length > 0) {
    await db
      .update(vehicles)
      .set({ ...safe, updated_at: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(vehicles.tenant_id, tenantId), eq(vehicles.id, id)));
  }
  return getVehicle(tenantId, id);
}

export async function deleteVehicle(tenantId: number, id: number): Promise<void> {
  await db
    .delete(vehicles)
    .where(and(eq(vehicles.tenant_id, tenantId), eq(vehicles.id, id)));
}

// --- Photos (tenant-scoped) ---

export async function addPhoto(
  tenantId: number,
  vehicleId: number,
  url: string,
  orderIdx = 0,
): Promise<VehiclePhotoRow> {
  const [row] = await db
    .insert(vehicle_photos)
    .values({ tenant_id: tenantId, vehicle_id: vehicleId, url, order_idx: orderIdx })
    .returning();
  return row;
}

export async function deletePhoto(tenantId: number, url: string): Promise<void> {
  await db
    .delete(vehicle_photos)
    .where(and(eq(vehicle_photos.tenant_id, tenantId), eq(vehicle_photos.url, url)));
}

export async function getPhotosByVehicle(
  tenantId: number,
  vehicleId: number,
): Promise<VehiclePhotoRow[]> {
  return db
    .select()
    .from(vehicle_photos)
    .where(
      and(eq(vehicle_photos.tenant_id, tenantId), eq(vehicle_photos.vehicle_id, vehicleId)),
    )
    .orderBy(vehicle_photos.order_idx);
}

// --- Documents (anexos internos do veículo) ---

export async function addVehicleDocument(input: {
  tenantId: number;
  vehicleId: number;
  name: string;
  category: string;
  url: string;
  size?: number | null;
  mimeType?: string | null;
  uploadedBy?: number | null;
}): Promise<VehicleDocumentRow> {
  const [row] = await db
    .insert(vehicle_documents)
    .values({
      tenant_id: input.tenantId,
      vehicle_id: input.vehicleId,
      name: input.name,
      category: input.category,
      url: input.url,
      size: input.size ?? null,
      mime_type: input.mimeType ?? null,
      uploaded_by: input.uploadedBy ?? null,
    })
    .returning();
  return row;
}

export async function deleteVehicleDocument(
  tenantId: number,
  documentId: number,
): Promise<VehicleDocumentRow | null> {
  const [row] = await db
    .select()
    .from(vehicle_documents)
    .where(and(eq(vehicle_documents.tenant_id, tenantId), eq(vehicle_documents.id, documentId)))
    .limit(1);
  if (!row) return null;
  await db.delete(vehicle_documents).where(eq(vehicle_documents.id, documentId));
  return row;
}

export async function getDocumentsByVehicle(
  tenantId: number,
  vehicleId: number,
): Promise<VehicleDocumentRow[]> {
  return db
    .select()
    .from(vehicle_documents)
    .where(
      and(
        eq(vehicle_documents.tenant_id, tenantId),
        eq(vehicle_documents.vehicle_id, vehicleId),
      ),
    )
    .orderBy(desc(vehicle_documents.created_at));
}

// --- Transactions (tenant-scoped) ---

export interface TransactionFilters {
  vehicle_id?: number;
  type?: string;
  month?: string;
  year?: string;
}

export async function listTransactions(
  tenantId: number,
  filters: TransactionFilters = {},
): Promise<TransactionWithVehicle[]> {
  const conditions = [eq(transactions.tenant_id, tenantId)];

  if (filters.vehicle_id) conditions.push(eq(transactions.vehicle_id, filters.vehicle_id));
  if (filters.type) conditions.push(eq(transactions.type, filters.type));
  if (filters.year) conditions.push(like(transactions.date, `${filters.year}%`));
  if (filters.month) conditions.push(like(transactions.date, `${filters.month}%`));

  const rows = await db
    .select({
      ...getTableColumns(transactions),
      vehicle_brand: vehicles.brand,
      vehicle_model: vehicles.model,
      vehicle_year: vehicles.year,
    })
    .from(transactions)
    .innerJoin(vehicles, eq(vehicles.id, transactions.vehicle_id))
    .where(and(...conditions))
    .orderBy(desc(transactions.date), desc(transactions.created_at));

  return rows as TransactionWithVehicle[];
}

export async function getTransaction(
  tenantId: number,
  id: number,
): Promise<TransactionRow | null> {
  const [row] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.tenant_id, tenantId), eq(transactions.id, id)))
    .limit(1);
  return row ?? null;
}

export async function createTransaction(
  tenantId: number,
  input: TransactionInput,
): Promise<TransactionRow> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(transactions)
      .values({
        tenant_id: tenantId,
        vehicle_id: input.vehicle_id,
        type: input.type,
        amount: input.amount,
        date: input.date,
        buyer_name: input.buyer_name,
        buyer_phone: input.buyer_phone,
        notes: input.notes,
      })
      .returning();

    if (input.type === "saida" || input.type === "entrada") {
      const newStatus = input.type === "saida" ? "vendido" : "disponivel";
      await tx
        .update(vehicles)
        .set({ status: newStatus, updated_at: sql`CURRENT_TIMESTAMP` })
        .where(and(eq(vehicles.tenant_id, tenantId), eq(vehicles.id, input.vehicle_id)));
    }

    return row;
  });
}

const TRANSACTION_UPDATE_FIELDS = ["amount", "date", "buyer_name", "buyer_phone", "notes"] as const;

export async function updateTransaction(
  tenantId: number,
  id: number,
  input: Partial<TransactionInput>,
): Promise<TransactionRow | null> {
  const safe: Record<string, unknown> = {};
  for (const key of TRANSACTION_UPDATE_FIELDS) {
    if (key in input) safe[key] = input[key];
  }
  if (Object.keys(safe).length > 0) {
    await db
      .update(transactions)
      .set(safe)
      .where(and(eq(transactions.tenant_id, tenantId), eq(transactions.id, id)));
  }
  return getTransaction(tenantId, id);
}

export async function deleteTransaction(tenantId: number, id: number): Promise<void> {
  await db
    .delete(transactions)
    .where(and(eq(transactions.tenant_id, tenantId), eq(transactions.id, id)));
}

// --- Dashboard (tenant-scoped) ---

export async function getDashboardStats(tenantId: number): Promise<DashboardStats> {
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const stockByStatus = (await db.all(sql`
    SELECT status, COUNT(*) as count
    FROM vehicles
    WHERE tenant_id = ${tenantId}
    GROUP BY status
  `)) as StockByStatus[];

  const monthlySales = (await db.get(sql`
    SELECT COUNT(*) as units, COALESCE(SUM(amount), 0) as revenue
    FROM transactions
    WHERE tenant_id = ${tenantId} AND type = 'saida' AND date LIKE ${`${monthStr}%`}
  `)) as { units: number; revenue: number };

  const totalCostValue = (await db.get(sql`
    SELECT COALESCE(SUM(cost_price), 0) as total
    FROM vehicles
    WHERE tenant_id = ${tenantId} AND status != 'vendido'
  `)) as { total: number };

  const monthlyProfit = (await db.get(sql`
    SELECT COALESCE(SUM(t.amount - v.cost_price), 0) as profit
    FROM transactions t
    JOIN vehicles v ON v.id = t.vehicle_id
    WHERE t.tenant_id = ${tenantId} AND t.type = 'saida' AND t.date LIKE ${`${monthStr}%`}
  `)) as { profit: number };

  const monthly = (await db.all(sql`
    SELECT strftime('%Y-%m', t.date) as month,
           SUM(t.amount) as revenue,
           SUM(t.amount - v.cost_price) as profit,
           COUNT(*) as units
    FROM transactions t
    JOIN vehicles v ON v.id = t.vehicle_id
    WHERE t.tenant_id = ${tenantId} AND t.type = 'saida'
    GROUP BY month
    ORDER BY month DESC
    LIMIT 12
  `)) as MonthlyData[];

  return {
    stockByStatus,
    monthlySales: { units: monthlySales?.units ?? 0, revenue: monthlySales?.revenue ?? 0 },
    totalCostValue: totalCostValue?.total ?? 0,
    monthlyProfit: monthlyProfit?.profit ?? 0,
    monthly,
  };
}

// --- Leads (tenant-scoped CRM) ---

export interface LeadFilters {
  status?: string;
  source?: string;
  vehicle_id?: number;
}

export async function listLeads(
  tenantId: number,
  filters: LeadFilters = {},
): Promise<LeadRow[]> {
  const conditions = [eq(leads.tenant_id, tenantId)];
  if (filters.status) conditions.push(eq(leads.status, filters.status));
  if (filters.source) conditions.push(eq(leads.source, filters.source));
  if (filters.vehicle_id) conditions.push(eq(leads.vehicle_id, filters.vehicle_id));

  return db
    .select()
    .from(leads)
    .where(and(...conditions))
    .orderBy(desc(leads.created_at));
}

export async function getLead(tenantId: number, id: number): Promise<LeadRow | null> {
  const [row] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.tenant_id, tenantId), eq(leads.id, id)))
    .limit(1);
  return row ?? null;
}

export async function createLead(
  tenantId: number,
  input: Omit<NewLead, "id" | "tenant_id" | "created_at">,
): Promise<LeadRow> {
  const [row] = await db
    .insert(leads)
    .values({ ...input, tenant_id: tenantId })
    .returning();
  return row;
}

const LEAD_UPDATE_FIELDS = ["name", "phone", "email", "message", "source", "status", "vehicle_id"] as const;

export async function updateLead(
  tenantId: number,
  id: number,
  input: Partial<NewLead>,
): Promise<LeadRow | null> {
  const safe: Record<string, unknown> = {};
  for (const key of LEAD_UPDATE_FIELDS) {
    if (key in input) safe[key] = input[key as keyof NewLead];
  }
  if (Object.keys(safe).length > 0) {
    await db
      .update(leads)
      .set(safe)
      .where(and(eq(leads.tenant_id, tenantId), eq(leads.id, id)));
  }
  return getLead(tenantId, id);
}

export async function deleteLead(tenantId: number, id: number): Promise<void> {
  await db.delete(leads).where(and(eq(leads.tenant_id, tenantId), eq(leads.id, id)));
}

// --- Platform / super-admin (cross-tenant) ---

export interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalVehicles: number;
  totalLeads: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const byStatus = (await db.all(sql`
    SELECT status, COUNT(*) as count FROM tenants GROUP BY status
  `)) as { status: string; count: number }[];
  const vehicleCount = (await db.get(sql`SELECT COUNT(*) as c FROM vehicles`)) as { c: number };
  const leadCount = (await db.get(sql`SELECT COUNT(*) as c FROM leads`)) as { c: number };

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
  return (await db.all(sql`
    SELECT t.*,
      (SELECT COUNT(*) FROM vehicles v WHERE v.tenant_id = t.id) as vehicle_count,
      (SELECT COUNT(*) FROM leads l WHERE l.tenant_id = t.id) as lead_count
    FROM tenants t
    ORDER BY t.created_at DESC
  `)) as TenantWithStats[];
}

// --- Partners (links de desconto / atribuição) ---

export async function listPartners(): Promise<PartnerRow[]> {
  return db.select().from(partners).orderBy(desc(partners.created_at));
}

export async function getPartnerById(id: number): Promise<PartnerRow | null> {
  const [row] = await db.select().from(partners).where(eq(partners.id, id)).limit(1);
  return row ?? null;
}

/** Parceiro pelo código, cru — para checagem de unicidade no admin. */
export async function getPartnerByCodeRaw(code: string): Promise<PartnerRow | null> {
  const [row] = await db.select().from(partners).where(eq(partners.code, code)).limit(1);
  return row ?? null;
}

/**
 * Parceiro **utilizável** num cadastro `?parceiro=`: precisa estar ativo,
 * dentro do limite de usos e da validade. Caso contrário → null.
 */
export async function getPartnerByCode(code: string): Promise<PartnerRow | null> {
  const partner = await getPartnerByCodeRaw(code);
  if (!partner || partner.status !== "active") return null;
  if (partner.max_uses != null && partner.signup_count >= partner.max_uses) return null;
  if (partner.expires_at && partner.expires_at < new Date().toISOString().slice(0, 10)) {
    return null;
  }
  return partner;
}

export async function createPartner(input: NewPartner): Promise<PartnerRow> {
  const [row] = await db.insert(partners).values(input).returning();
  return row;
}

export async function updatePartner(
  id: number,
  input: Partial<NewPartner>,
): Promise<PartnerRow | null> {
  // signup_count nunca é editado à mão — só por incrementPartnerSignup.
  const { id: _id, created_at: _ca, signup_count: _sc, ...safe } = input;
  void _id;
  void _ca;
  void _sc;
  if (Object.keys(safe).length > 0) {
    await db.update(partners).set(safe).where(eq(partners.id, id));
  }
  return getPartnerById(id);
}

export async function deletePartner(id: number): Promise<void> {
  await db.delete(partners).where(eq(partners.id, id));
}

/** Concessionárias atribuídas a um parceiro (relatório de atribuição). */
export async function getTenantsReferredBy(partnerId: number): Promise<TenantRow[]> {
  return db
    .select()
    .from(tenants)
    .where(eq(tenants.referred_by, partnerId))
    .orderBy(desc(tenants.created_at));
}

/** Soma 1 ao contador de cadastros atribuídos a um parceiro. */
export async function incrementPartnerSignup(id: number): Promise<void> {
  await db
    .update(partners)
    .set({ signup_count: sql`${partners.signup_count} + 1` })
    .where(eq(partners.id, id));
}
