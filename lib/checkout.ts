import MercadoPagoConfig, { PreApproval, PreApprovalPlan } from "mercadopago";
import type { Plan } from "@/lib/plans";
import type { CouponRow, PartnerRow, TenantRow } from "@/lib/schema";
import { discountedPriceCents } from "@/lib/coupon-pricing";
import { tenantSiteUrl } from "@/lib/marketplace";

function getMpClient() {
  return new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! });
}

function subscriptionReason(plan: Plan, coupon: CouponRow | null): string {
  if (!coupon) return `AutoStand ${plan.name}`;
  if (coupon.discount_type === "percentage") return `AutoStand ${plan.name} — ${coupon.discount_value}% de desconto`;
  if (coupon.discount_type === "free_month") return `AutoStand ${plan.name} — 1º mês grátis`;
  return `AutoStand ${plan.name} — desconto especial`;
}

function autoRecurringBody(plan: Plan, coupon: CouponRow | null): Record<string, unknown> {
  const priceCents = coupon ? discountedPriceCents(plan, coupon) : plan.priceMonthly;
  const body: Record<string, unknown> = {
    frequency: 1,
    frequency_type: "months",
    transaction_amount: Math.max(1, priceCents) / 100, // piso de código; MP tem mínimo próprio
    currency_id: "BRL",
  };
  if (coupon?.discount_type === "free_month") {
    body.free_trial = { frequency: 1, frequency_type: "months" };
  }
  return body;
}

async function createMpPlan(tenant: TenantRow, plan: Plan, coupon: CouponRow | null): Promise<string> {
  const preApprovalPlan = new PreApprovalPlan(getMpClient());
  const newPlan = await preApprovalPlan.create({
    body: {
      reason: subscriptionReason(plan, coupon),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      auto_recurring: autoRecurringBody(plan, coupon) as any,
      // Volta pro painel da PRÓPRIA loja (subdomínio ou custom_domain).
      // Usar o domínio da plataforma levaria a /admin num host sem tenant
      // (404 + sessão perdida, pois o cookie é host-only do subdomínio).
      back_url: `${tenantSiteUrl(tenant)}/admin/assinatura`,
    },
  });

  if (!newPlan.id) throw new Error("MP did not return a plan id");
  return newPlan.id;
}

/**
 * Monta a URL de checkout de assinatura do Mercado Pago. SEMPRE cria um
 * PreApprovalPlan dedicado ao tenant (preço cheio ou com cupom) para que o
 * `back_url` aponte pro painel da própria loja. Os planos pré-criados
 * (`MERCADOPAGO_PLAN_*`) não são mais usados aqui — um plano compartilhado
 * teria back_url fixo, caindo num host sem tenant após o pagamento.
 */
export async function createCheckoutSession(
  tenant: TenantRow,
  plan: Plan,
  _partner: PartnerRow | null,
  coupon?: CouponRow | null,
): Promise<string | null> {
  const mpPlanId = await createMpPlan(tenant, plan, coupon ?? null);

  const params = new URLSearchParams({
    preapproval_plan_id: mpPlanId,
    external_reference: String(tenant.id),
  });

  return `https://www.mercadopago.com.br/subscriptions/checkout?${params.toString()}`;
}

export async function cancelMpSubscription(subscriptionId: string): Promise<void> {
  const preApproval = new PreApproval(getMpClient());
  await preApproval.update({ id: subscriptionId, body: { status: "cancelled" } });
}

export interface TransparentSubscriptionResult {
  id: string;
  status: string;
  statusDetail: string | null;
}

/**
 * Checkout Transparente: cria o PreApproval direto via API com um card_token
 * tokenizado no navegador (Card Brick). O pagador não precisa de conta MP.
 * Retorna o status já resolvido (authorized/pending/rejected).
 */
export async function createTransparentSubscription(
  tenant: TenantRow,
  plan: Plan,
  coupon: CouponRow | null,
  cardToken: string,
  payerEmail: string,
): Promise<TransparentSubscriptionResult> {
  const preApproval = new PreApproval(getMpClient());
  const res = await preApproval.create({
    body: {
      reason: subscriptionReason(plan, coupon),
      external_reference: String(tenant.id),
      payer_email: payerEmail,
      card_token_id: cardToken,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      auto_recurring: autoRecurringBody(plan, coupon) as any,
      back_url: `${tenantSiteUrl(tenant)}/admin/assinatura`,
      status: "authorized",
    },
  });

  if (!res.id) throw new Error("MP did not return a preapproval id");
  return {
    id: String(res.id),
    status: String(res.status ?? "pending"),
    statusDetail: (res as { status_detail?: string }).status_detail ?? null,
  };
}
