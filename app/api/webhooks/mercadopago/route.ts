import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import MercadoPagoConfig, { PreApproval } from "mercadopago";
import { getTenantById, setTenantSubscriptionState } from "@/lib/db";
import { notifyPaymentStatus } from "@/lib/email/notify";

/** Status do preapproval do MP → status interno usado na notificação. */
const MP_TO_INTERNAL: Record<string, string> = {
  authorized: "active",
  paused: "past_due",
  cancelled: "cancelled",
};

function getMpClient() {
  return new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! });
}

function verifySignature(secret: string, xSignature: string, xRequestId: string, dataId: string): boolean {
  const parts = Object.fromEntries(xSignature.split(",").map((p) => p.split("=")));
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  if (v1.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const xSignature = req.headers.get("x-signature") ?? "";
  const xRequestId = req.headers.get("x-request-id") ?? "";
  const dataId = body.data?.id ?? "";
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }
  if (!verifySignature(secret, xSignature, xRequestId, dataId)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (body.type !== "preapproval" || !dataId) {
    return NextResponse.json({ received: true });
  }

  const preApproval = new PreApproval(getMpClient());
  const subscription = await preApproval.get({ id: dataId });

  const tenantId = subscription.external_reference as string | undefined;
  const mpStatus = subscription.status as string;
  const tenantIdNum = tenantId ? Number(tenantId) : NaN;

  if (tenantId && Number.isInteger(tenantIdNum) && tenantIdNum > 0) {
    const internal = MP_TO_INTERNAL[mpStatus];
    const before = await getTenantById(tenantIdNum);
    await setTenantSubscriptionState(tenantIdNum, mpStatus, dataId);
    // Notifica só na TRANSIÇÃO de status (evita e-mail duplicado em webhook
    // repetido, e o "site no ar" do transparente já saiu pela rota /pagamento).
    if (before && internal && before.subscription_status !== internal) {
      void notifyPaymentStatus(before, internal);
    }
  }

  return NextResponse.json({ received: true });
}
