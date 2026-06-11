import { NextRequest, NextResponse } from "next/server";
import { getCouponByCode } from "@/lib/db";
import { getPlan, isPlanSlug } from "@/lib/plans";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";
import { formatBRLFull } from "@/lib/money";
import { discountedPriceCents } from "@/lib/coupon-pricing";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit("couponValidate", ip);
  if (!rl.ok) {
    return NextResponse.json({ valid: false, error: "Muitas tentativas. Tente novamente em breve." }, { status: 429 });
  }

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
  const discountedCents = discountedPriceCents(plan, coupon);
  let preview: string;

  if (coupon.discount_type === "percentage") {
    preview = `${coupon.discount_value}% de desconto — ${formatBRLFull(discountedCents)}/mês`;
  } else if (coupon.discount_type === "fixed") {
    preview = `${formatBRLFull(coupon.discount_value ?? 0)} de desconto — ${formatBRLFull(discountedCents)}/mês`;
  } else {
    preview = "Primeiro mês grátis!";
  }

  return NextResponse.json({
    valid: true,
    preview,
    discountedCents,
    coupon: {
      code: coupon.code,
      description: coupon.description,
    },
  });
}
