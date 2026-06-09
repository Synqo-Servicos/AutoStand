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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: {
      preapproval_plan_id: plan.mpPlanId,
      reason: `AutoStand ${plan.name}`,
      back_url: backUrl,
      notification_url: `https://${process.env.PLATFORM_DOMAIN}/api/webhooks/mercadopago`,
      status: "pending",
      external_reference: String(tenant.id),
    } as any,
  });

  return result.init_point ?? null;
}

export async function cancelMpSubscription(subscriptionId: string): Promise<void> {
  const preApproval = new PreApproval(getMpClient());
  await preApproval.update({ id: subscriptionId, body: { status: "cancelled" } });
}
