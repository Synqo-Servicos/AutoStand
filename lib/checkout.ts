import MercadoPagoConfig, { PreApproval, PreApprovalPlan } from "mercadopago";
import type { Plan } from "@/lib/plans";
import type { CouponRow, PartnerRow, TenantRow } from "@/lib/schema";
import { discountedPriceCents } from "@/lib/coupon-pricing";
import { tenantSiteUrl } from "@/lib/marketplace";

function getMpClient() {
  return new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! });
}

async function createMpPlan(tenant: TenantRow, plan: Plan, coupon: CouponRow | null): Promise<string> {
  // Valor cobrado em centavos — sem cupom é a mensalidade cheia; com cupom usa
  // a fonte única compartilhada com a prévia pública (/api/cupons/validate).
  // MP exige valor positivo, então o piso é 1 centavo.
  const priceCents = coupon ? discountedPriceCents(plan, coupon) : plan.priceMonthly;
  const amount = Math.max(1, priceCents) / 100;

  const reason = !coupon
    ? `AutoStand ${plan.name}`
    : coupon.discount_type === "percentage"
      ? `AutoStand ${plan.name} — ${coupon.discount_value}% de desconto`
      : coupon.discount_type === "free_month"
        ? `AutoStand ${plan.name} — 1º mês grátis`
        : `AutoStand ${plan.name} — desconto especial`;

  const autoRecurring: Record<string, unknown> = {
    frequency: 1,
    frequency_type: "months",
    transaction_amount: amount,
    currency_id: "BRL",
  };

  if (coupon?.discount_type === "free_month") {
    autoRecurring.free_trial = { frequency: 1, frequency_type: "months" };
  }

  const preApprovalPlan = new PreApprovalPlan(getMpClient());
  const newPlan = await preApprovalPlan.create({
    body: {
      reason,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      auto_recurring: autoRecurring as any,
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
