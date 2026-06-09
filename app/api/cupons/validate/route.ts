import { NextRequest, NextResponse } from "next/server";
import { getCouponByCode } from "@/lib/db";
import { getPlan, isPlanSlug } from "@/lib/plans";

function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") ?? "").trim();
  const planSlug = searchParams.get("plan") ?? "";

  if (!code) {
    return NextResponse.json({ valid: false, error: "Informe o código do cupom." });
  }
  if (!isPlanSlug(planSlug)) {
    return NextResponse.json({ valid: false, error: "Plano inválido." });
  }

  const coupon = await getCouponByCode(code);
  if (!coupon) {
    return NextResponse.json({ valid: false, error: "Cupom inválido ou expirado." });
  }

  const plan = getPlan(planSlug);
  let discountedCents: number;
  let preview: string;

  if (coupon.discount_type === "percentage") {
    discountedCents = Math.round(plan.priceMonthly * (1 - (coupon.discount_value ?? 0) / 100));
    preview = `${coupon.discount_value}% de desconto — ${formatBRL(discountedCents)}/mês`;
  } else if (coupon.discount_type === "fixed") {
    discountedCents = Math.max(0, plan.priceMonthly - (coupon.discount_value ?? 0));
    preview = `${formatBRL(coupon.discount_value ?? 0)} de desconto — ${formatBRL(discountedCents)}/mês`;
  } else {
    discountedCents = plan.priceMonthly;
    preview = "Primeiro mês grátis!";
  }

  return NextResponse.json({
    valid: true,
    preview,
    discountedCents,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      description: coupon.description,
    },
  });
}
