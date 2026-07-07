import { NextRequest, NextResponse } from "next/server";
import {
  getTenantById, getCouponById, setTenantSubscriptionState,
  claimTenantForCheckout, releaseTenantCheckout,
} from "@/lib/db";
import { getPlan, isPlanSlug } from "@/lib/plans";
import { createTransparentSubscription } from "@/lib/checkout";
import { verifyPaymentToken } from "@/lib/payment-token";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Etapa 2 do cadastro (Checkout Transparente). Recebe o card_token tokenizado
 * no navegador + o token de pagamento assinado do /assinar, cria a assinatura
 * no MP e ativa o tenant. Público — autorizado pelo paymentToken (HMAC), não
 * por sessão. Rate-limited por IP.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit("checkoutPayment", ip);
  if (!rl.ok) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente em instantes." }, { status: 429 });
  }

  let body: { paymentToken?: unknown; card_token?: unknown; payer_email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const paymentToken = typeof body.paymentToken === "string" ? body.paymentToken : "";
  const cardToken = typeof body.card_token === "string" ? body.card_token : "";
  const payerEmail = typeof body.payer_email === "string" ? body.payer_email.trim().toLowerCase() : "";

  const payload = verifyPaymentToken(paymentToken);
  if (!payload) {
    return NextResponse.json({ error: "Sessão de pagamento expirada. Refaça o cadastro." }, { status: 401 });
  }
  if (!cardToken) return NextResponse.json({ error: "Cartão inválido." }, { status: 400 });
  if (!EMAIL_RE.test(payerEmail)) return NextResponse.json({ error: "E-mail do pagador inválido." }, { status: 400 });
  if (!isPlanSlug(payload.planSlug)) return NextResponse.json({ error: "Plano inválido." }, { status: 400 });

  const tenant = await getTenantById(payload.tenantId);
  if (!tenant) return NextResponse.json({ error: "Loja não encontrada." }, { status: 404 });

  // Idempotência: se já saiu de incomplete, a assinatura já foi criada.
  if (tenant.subscription_status !== "incomplete") {
    return NextResponse.json({ ok: true, slug: tenant.slug, status: "already_active" });
  }

  // Reivindica atomicamente — se outro request concorrente já reivindicou,
  // este perde a corrida e não cria uma segunda assinatura.
  const claimed = await claimTenantForCheckout(tenant.id);
  if (!claimed) {
    return NextResponse.json({ ok: true, slug: tenant.slug, status: "already_active" });
  }

  const coupon = payload.couponId ? await getCouponById(payload.couponId) : null;
  const plan = getPlan(payload.planSlug);

  let result;
  try {
    result = await createTransparentSubscription(tenant, plan, coupon, cardToken, payerEmail);
  } catch (err) {
    console.error("[assinar/pagamento] erro no MP:", err);
    await releaseTenantCheckout(tenant.id);
    return NextResponse.json({ error: "Não foi possível processar o pagamento. Tente novamente." }, { status: 502 });
  }

  if (result.status === "authorized") {
    await setTenantSubscriptionState(tenant.id, "authorized", result.id);
    return NextResponse.json({ ok: true, slug: tenant.slug, status: "authorized" });
  }
  if (result.status === "pending" || result.status === "in_process") {
    // Não ativa ainda — o webhook (external_reference = tenant.id) reconcilia.
    return NextResponse.json({ ok: true, slug: tenant.slug, status: "pending" });
  }
  await releaseTenantCheckout(tenant.id);
  return NextResponse.json(
    { ok: false, status: result.status, detail: result.statusDetail, error: "Pagamento recusado. Verifique os dados do cartão ou tente outro." },
    { status: 402 },
  );
}
