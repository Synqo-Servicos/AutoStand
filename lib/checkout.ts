import MercadoPagoConfig, { PreApproval } from "mercadopago";
import type { Plan } from "@/lib/plans";
import type { PartnerRow, TenantRow } from "@/lib/schema";

function getMpClient() {
  return new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! });
}

/**
 * Builds the MP plan checkout URL for plan-based subscriptions.
 * MP requires the user to provide card details on their hosted page
 * (creating a preapproval via API requires card_token_id upfront).
 * external_reference links the subscription back to the tenant on webhook.
 */
export async function createCheckoutSession(
  tenant: TenantRow,
  plan: Plan,
  _partner: PartnerRow | null,
): Promise<string | null> {
  if (!plan.mpPlanId) return null;

  const params = new URLSearchParams({
    preapproval_plan_id: plan.mpPlanId,
    external_reference: String(tenant.id),
  });

  return `https://www.mercadopago.com.br/subscriptions/checkout?${params.toString()}`;
}

export async function cancelMpSubscription(subscriptionId: string): Promise<void> {
  const preApproval = new PreApproval(getMpClient());
  await preApproval.update({ id: subscriptionId, body: { status: "cancelled" } });
}
