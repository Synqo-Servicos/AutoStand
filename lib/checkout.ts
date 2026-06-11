import MercadoPagoConfig, { PreApproval, PreApprovalPlan } from "mercadopago";
import type { Plan } from "@/lib/plans";
import type { CouponRow, PartnerRow, TenantRow } from "@/lib/schema";
import { discountedPriceCents } from "@/lib/coupon-pricing";

function getMpClient() {
  return new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! });
}

async function createDiscountedMpPlan(plan: Plan, coupon: CouponRow): Promise<string> {
  // Valor cobrado em centavos — fonte única compartilhada com a prévia pública
  // (/api/cupons/validate). MP exige valor positivo, então o piso é 1 centavo.
  const amount = Math.max(1, discountedPriceCents(plan, coupon)) / 100;

  const reason =
    coupon.discount_type === "percentage"
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

  if (coupon.discount_type === "free_month") {
    autoRecurring.free_trial = { frequency: 1, frequency_type: "months" };
  }

  const preApprovalPlan = new PreApprovalPlan(getMpClient());
  const newPlan = await preApprovalPlan.create({
    body: {
      reason,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      auto_recurring: autoRecurring as any,
      back_url: `https://${process.env.PLATFORM_DOMAIN ?? "autostand.com.br"}/admin/assinatura`,
    },
  });

  if (!newPlan.id) throw new Error("MP did not return a plan id");
  return newPlan.id;
}

/**
 * Builds the MP plan checkout URL.
 * If a coupon is provided, creates a discounted plan on-the-fly via PreApprovalPlan API.
 */
export async function createCheckoutSession(
  tenant: TenantRow,
  plan: Plan,
  _partner: PartnerRow | null,
  coupon?: CouponRow | null,
): Promise<string | null> {
  const mpPlanId = coupon
    ? await createDiscountedMpPlan(plan, coupon)
    : plan.mpPlanId;

  if (!mpPlanId) return null;

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
