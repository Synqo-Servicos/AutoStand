import { NextResponse } from "next/server";
import { ApiError, withSuperAdmin } from "@/lib/api";
import { createCoupon, getCouponByCodeRaw, listCoupons } from "@/lib/db";
import { createCouponSchema } from "@/lib/validation";

export const GET = withSuperAdmin(async () => {
  return NextResponse.json(await listCoupons());
});

export const POST = withSuperAdmin(async (req, { userId }) => {
  const raw = await req.json();
  const parsed = createCouponSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Dados inválidos.";
    throw new ApiError(msg, 400);
  }
  const { code, description, discount_type, max_uses, expires_at, partner_id } = parsed.data;

  let discount_value: number | null = null;
  if (discount_type === "percentage") {
    const pct = Math.round(Number(parsed.data.discount_value) || 0);
    if (pct < 0 || pct > 100) throw new ApiError("Percentual deve ser entre 0 e 100.", 400);
    discount_value = pct;
  } else if (discount_type === "fixed") {
    // UI envia em reais; armazenar em centavos
    discount_value = Math.max(0, Math.round((Number(parsed.data.discount_value) || 0) * 100));
  }

  if (await getCouponByCodeRaw(code)) {
    throw new ApiError("Já existe um cupom com este código.", 400);
  }

  const coupon = await createCoupon({
    code,
    description,
    discount_type,
    discount_value,
    max_uses,
    expires_at,
    partner_id,
    created_by: userId,
  });

  return NextResponse.json(coupon, { status: 201 });
});
