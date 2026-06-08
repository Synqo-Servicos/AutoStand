import MercadoPagoConfig, { PreApproval } from "mercadopago";
import type { Plan } from "@/lib/plans";
import type { PartnerRow, TenantRow } from "@/lib/schema";

function getMpClient() {
  return new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! });
}

export async function createCheckoutSession(
  tenant: TenantRow,
  plan: Plan,
  _partner: PartnerRow | null,
): Promise<string | null> {
  if (!plan.mpPlanId) return null;

  const preApproval = new PreApproval(getMpClient());
  const backUrl = `${process.env.AUTH_URL ?? "https://autostand.com.br"}/admin/assinatura`;

  const result = await preApproval.create({
    body: {
      preapproval_plan_id: plan.mpPlanId,
      reason: `AutoStand ${plan.name}`,
      back_url: backUrl,
      status: "pending",
      external_reference: tenant.id,
    },
  });

  return result.init_point ?? null;
}

export async function cancelMpSubscription(subscriptionId: string): Promise<void> {
  const preApproval = new PreApproval(getMpClient());
  await preApproval.update({ id: subscriptionId, body: { status: "cancelled" } });
}
