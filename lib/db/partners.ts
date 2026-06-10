import { desc, eq, sql } from "drizzle-orm";
import { partners, tenants } from "@/lib/schema";
import type { NewPartner, PartnerRow, TenantRow } from "@/lib/schema";
import { db, type Tx } from "./client";

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
export async function incrementPartnerSignup(id: number, tx?: Tx): Promise<void> {
  const orm = tx ?? db;
  await orm
    .update(partners)
    .set({ signup_count: sql`${partners.signup_count} + 1` })
    .where(eq(partners.id, id));
}
