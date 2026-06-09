import { desc, eq, sql } from "drizzle-orm";
import { coupons } from "@/lib/schema";
import type { CouponRow, NewCoupon } from "@/lib/schema";
import { db } from "./client";

export async function listCoupons(): Promise<CouponRow[]> {
  return db.select().from(coupons).orderBy(desc(coupons.created_at));
}

export async function getCouponByCodeRaw(code: string): Promise<CouponRow | null> {
  const [row] = await db
    .select()
    .from(coupons)
    .where(eq(coupons.code, code.toUpperCase()))
    .limit(1);
  return row ?? null;
}

/**
 * Verifica se um cupom é utilizável: precisa ter usos restantes e não estar expirado.
 * Função pura — recebe o row e a data de hoje (YYYY-MM-DD) para facilitar testes.
 */
export function isCouponValid(coupon: CouponRow, today = new Date().toISOString().slice(0, 10)): boolean {
  if (coupon.used_count >= coupon.max_uses) return false;
  if (coupon.expires_at && coupon.expires_at < today) return false;
  return true;
}

/**
 * Cupom utilizável num cadastro: precisa ter usos restantes e não estar expirado.
 */
export async function getCouponByCode(code: string): Promise<CouponRow | null> {
  const coupon = await getCouponByCodeRaw(code);
  if (!coupon) return null;
  if (!isCouponValid(coupon)) return null;
  return coupon;
}

export async function createCoupon(input: NewCoupon): Promise<CouponRow> {
  const [row] = await db
    .insert(coupons)
    .values({ ...input, code: input.code.toUpperCase() })
    .returning();
  return row;
}

export async function incrementCouponUse(id: number): Promise<void> {
  await db
    .update(coupons)
    .set({ used_count: sql`${coupons.used_count} + 1` })
    .where(eq(coupons.id, id));
}
