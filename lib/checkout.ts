import MercadoPagoConfig, { PreApproval, PreApprovalPlan } from "mercadopago";
import type { Plan } from "@/lib/plans";
import type { CouponRow, PartnerRow, TenantRow } from "@/lib/schema";

function getMpClient() {
  return new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! });
}

async function createDiscountedMpPlan(plan: Plan, coupon: CouponRow): Promise<string> {
  const baseBRL = plan.priceMonthly / 100;

  let amount: number;
  let reason: string;

  if (coupon.discount_type === "percentage") {
    amount = Math.round(plan.priceMonthly * (1 - (coupon.discount_value ?? 0) / 100)) / 100;
    reason = `AutoStand ${plan.name} — ${coupon.discount_value}% de desconto`;
  } else if (coupon.discount_type === "fixed") {
    amount = Math.max(0.01, (plan.priceMonthly - (coupon.discount_value ?? 0)) / 100);
    reason = `AutoStand ${plan.name} — desconto especial`;
  } else {
    // free_month — base price + free trial of 1 month
    amount = baseBRL;
    reason = `AutoStand ${plan.name} — 1º mês grátis`;
  }

  // Round to 2 decimal places (MP requires centavo precision)
  amount = Math.round(amount * 100) / 100;

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
