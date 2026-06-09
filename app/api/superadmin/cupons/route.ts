import { NextResponse } from "next/server";
import { ApiError, withSuperAdmin } from "@/lib/api";
import { createCoupon, getCouponByCodeRaw, listCoupons } from "@/lib/db";

export const GET = withSuperAdmin(async () => {
  return NextResponse.json(await listCoupons());
});

export const POST = withSuperAdmin(async (req, { userId }) => {
  const body = await req.json();

  const code = String(body.code ?? "").trim().toUpperCase();
  const description = String(body.description ?? "").trim() || null;
  const discount_type = body.discount_type;
  const max_uses = Math.max(1, Math.round(Number(body.max_uses) || 1));
  const expires_at =
    typeof body.expires_at === "string" && body.expires_at.trim()
      ? body.expires_at.trim()
      : null;
  const partner_id =
    body.partner_id != null && body.partner_id !== ""
      ? Math.round(Number(body.partner_id))
      : null;

  if (code.length < 3) throw new ApiError("O código precisa de ao menos 3 caracteres.", 400);
  if (!["percentage", "fixed", "free_month"].includes(discount_type)) {
    throw new ApiError("Tipo de desconto inválido.", 400);
  }

  let discount_value: number | null = null;
  if (discount_type === "percentage") {
    discount_value = Math.max(0, Math.round(Number(body.discount_value) || 0));
    if (discount_value > 100) throw new ApiError("Percentual não pode passar de 100.", 400);
  } else if (discount_type === "fixed") {
    // body sends value in reais; store as centavos
    discount_value = Math.max(0, Math.round((Number(body.discount_value) || 0) * 100));
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
