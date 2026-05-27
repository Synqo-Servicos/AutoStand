import { and, eq } from "drizzle-orm";
import { sellers } from "@/lib/schema";
import type { Seller, SellerInput } from "@/types/seller";
import { db } from "./client";

export async function listSellers(tenantId: number): Promise<Seller[]> {
  const rows = await db
    .select()
    .from(sellers)
    .where(eq(sellers.tenant_id, tenantId))
    .orderBy(sellers.status, sellers.name);
  return rows as Seller[];
}

export async function getSeller(tenantId: number, id: number): Promise<Seller | null> {
  const [row] = await db
    .select()
    .from(sellers)
    .where(and(eq(sellers.tenant_id, tenantId), eq(sellers.id, id)))
    .limit(1);
  return (row as Seller | undefined) ?? null;
}

export async function createSeller(tenantId: number, input: SellerInput): Promise<Seller> {
  const [row] = await db
    .insert(sellers)
    .values({ ...input, tenant_id: tenantId })
    .returning();
  return row as Seller;
}

const SELLER_UPDATE_FIELDS = [
  "name", "phone", "email", "document", "photo_url",
  "commission_pct", "commission_fixed_cents", "status",
] as const;

export async function updateSeller(
  tenantId: number,
  id: number,
  input: Partial<SellerInput>,
): Promise<Seller | null> {
  const safe: Record<string, unknown> = {};
  for (const key of SELLER_UPDATE_FIELDS) {
    if (key in input) safe[key] = input[key];
  }
  if (Object.keys(safe).length > 0) {
    await db
      .update(sellers)
      .set(safe)
      .where(and(eq(sellers.tenant_id, tenantId), eq(sellers.id, id)));
  }
  return getSeller(tenantId, id);
}

export async function deleteSeller(tenantId: number, id: number): Promise<void> {
  await db.delete(sellers).where(and(eq(sellers.tenant_id, tenantId), eq(sellers.id, id)));
}

/**
 * Calcula comissão devida ao vendedor por uma venda.
 * `commission_pct` em centésimos de % (300 = 3%), `commission_fixed_cents`
 * em centavos. Resultado em centavos. Função pura — fácil de testar.
 */
export function computeCommission(
  saleAmountCents: number,
  seller: Pick<Seller, "commission_pct" | "commission_fixed_cents">,
): number {
  const pctPart = seller.commission_pct
    ? Math.round((saleAmountCents * seller.commission_pct) / 10000)
    : 0;
  const fixedPart = seller.commission_fixed_cents ?? 0;
  return pctPart + fixedPart;
}
