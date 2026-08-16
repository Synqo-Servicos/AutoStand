import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import MercadoPagoConfig, { Payment, PreApproval } from "mercadopago";
import { getTenantById, recordPayment, setTenantSubscriptionState, updatePaymentStatus } from "@/lib/db";
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

/**
 * Processa a notificação `type: "payment"` — é o topic que o MP dispara
 * para CADA cobrança recorrente de uma assinatura (`preapproval`), não só
 * para pagamentos avulsos; o recurso em si vem marcado com
 * `operation_type: "recurring_payment"`, mas o endpoint e o formato da
 * notificação são os mesmos de um pagamento comum. `data.id` é o id do
 * pagamento, buscável em `GET /v1/payments/:id` — daí o `Payment.get()`.
 *
 * Falha ao buscar no MP não grava linha pela metade: loga e retorna sem
 * lançar. Reprocessar é trabalho da reconciliação (Task 9); devolver erro
 * pro chamador (POST) faria o MP reenviar a notificação indefinidamente.
 */
async function handlePaymentNotification(dataId: string): Promise<void> {
  let payment;
  try {
    payment = await new Payment(getMpClient()).get({ id: dataId });
  } catch (err) {
    console.error("[webhooks/mercadopago] falha ao buscar pagamento no MP:", dataId, err);
    return;
  }

  const externalReference = payment.external_reference;
  const tenantIdNum = externalReference ? Number(externalReference) : NaN;
  if (!Number.isInteger(tenantIdNum) || tenantIdNum <= 0) {
    console.error("[webhooks/mercadopago] pagamento sem external_reference de tenant válido:", dataId);
    return;
  }

  const tenant = await getTenantById(tenantIdNum);
  if (!tenant) {
    console.error("[webhooks/mercadopago] tenant não encontrado para o pagamento:", dataId, tenantIdNum);
    return;
  }

  // Reais → centavos, sempre arredondando (nunca truncando).
  const grossCents = Math.round((payment.transaction_amount ?? 0) * 100);
  // `fee_details` ausente OU vazio = MP não informou a taxa nesta resposta.
  // Regra do domínio: nunca inventar a taxa — net = gross e a linha fica
  // marcada `incomplete` pra reconciliação revisitar depois.
  const feeDetails = payment.fee_details ?? [];
  const hasFee = feeDetails.length > 0;
  const feeCents = hasFee
    ? Math.round(feeDetails.reduce((sum, f) => sum + (f.amount ?? 0), 0) * 100)
    : null;
  const netCents = hasFee ? grossCents - (feeCents as number) : grossCents;
  const mpPaymentId = String(payment.id ?? dataId);
  const status = String(payment.status ?? "");
  const paidAt = payment.date_approved ?? payment.date_created ?? new Date().toISOString();

  const result = await recordPayment({
    tenant_id: tenant.id,
    tenant_name: tenant.name,
    tenant_document: tenant.document,
    plan: tenant.plan,
    mp_payment_id: mpPaymentId,
    mp_preapproval_id: tenant.mp_subscription_id,
    gross_cents: grossCents,
    fee_cents: feeCents,
    net_cents: netCents,
    status,
    paid_at: paidAt,
    coupon_id: tenant.coupon_id,
    incomplete: !hasFee,
  });

  // `recordPayment` é idempotente por `mp_payment_id` (`onConflictDoNothing`):
  // uma segunda notificação para o MESMO pagamento — o caso do estorno —
  // seria descartada em silêncio, e o pagamento contaria como receita para
  // sempre. `created: false` é o sinal de que a linha já existia; o status
  // novo (ex.: "refunded") precisa ser aplicado por UPDATE.
  if (!result.created) {
    await updatePaymentStatus(mpPaymentId, status);
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

  if (body.type === "payment" && dataId) {
    await handlePaymentNotification(dataId);
    return NextResponse.json({ received: true });
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
