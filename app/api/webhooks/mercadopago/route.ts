import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import MercadoPagoConfig, { Payment, PreApproval } from "mercadopago";
import {
  getPaymentByMpId, getTenantById, recordPayment, setTenantSubscriptionState, updatePayment,
  type UpdatePaymentInput,
} from "@/lib/db";
import { notifyPaymentStatus } from "@/lib/email/notify";

/** Status do preapproval do MP → status interno usado na notificação. */
const MP_TO_INTERNAL: Record<string, string> = {
  authorized: "active",
  paused: "past_due",
  cancelled: "cancelled",
};

/**
 * Status "terminais negativos": uma reentrega fora de ordem não pode
 * regredir a linha PRA FORA deles. Cenário real: o `approved` original
 * fica pendente de reenvio (ex.: o banco ficou fora e o POST devolveu
 * 500), o estorno chega e grava `refunded` primeiro, e o retry do
 * `approved` chega DEPOIS — sem essa guarda, o retry sobrescreveria
 * `refunded` de volta pra `approved` e a receita ficaria contada pra
 * sempre sobre um pagamento já devolvido.
 */
const TERMINAL_NEGATIVE_STATUSES = new Set(["refunded", "chargeback"]);

function shouldOverwriteStatus(currentStatus: string, incomingStatus: string): boolean {
  return !(TERMINAL_NEGATIVE_STATUSES.has(currentStatus) && !TERMINAL_NEGATIVE_STATUSES.has(incomingStatus));
}

function getMpClient() {
  return new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! });
}

type PaymentGetResult = Awaited<ReturnType<InstanceType<typeof Payment>["get"]>>;

/**
 * Bruto → líquido. Prioridade: `transaction_details.net_received_amount`
 * — o líquido autoritativo que o próprio MP calcula, derivando a taxa por
 * `gross - net`. Sem ele, soma `fee_details[]` filtrando por
 * `fee_payer !== "payer"` (taxa atribuída ao PAGADOR não é despesa nossa;
 * ausência de `fee_payer` é tratada como `collector`, o caso comum — ver
 * `node_modules/mercadopago/dist/clients/payment/commonTypes.d.ts`). Sem
 * nenhum dos dois: nunca inventar a taxa — `net = gross`,
 * `incomplete = true`.
 */
function computeFeeAndNet(
  payment: PaymentGetResult, grossCents: number,
): { feeCents: number | null; netCents: number; incomplete: boolean } {
  const netReceived = payment.transaction_details?.net_received_amount;
  if (typeof netReceived === "number") {
    const netCents = Math.round(netReceived * 100);
    return { feeCents: grossCents - netCents, netCents, incomplete: false };
  }
  const collectorFees = (payment.fee_details ?? []).filter((f) => f.fee_payer !== "payer");
  if (collectorFees.length === 0) {
    return { feeCents: null, netCents: grossCents, incomplete: true };
  }
  const feeCents = Math.round(collectorFees.reduce((sum, f) => sum + (f.amount ?? 0), 0) * 100);
  return { feeCents, netCents: grossCents - feeCents, incomplete: false };
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
  const { feeCents, netCents, incomplete } = computeFeeAndNet(payment, grossCents);
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
    incomplete,
  });

  if (result.created) return;

  // `recordPayment` é idempotente por `mp_payment_id` (`onConflictDoNothing`):
  // uma reentrega pro MESMO pagamento cai aqui, e "só atualizar o status"
  // não é seguro sozinho por dois motivos: (1) pode ter chegado FORA DE
  // ORDEM — ex. o retry do `approved` original, depois do estorno já ter
  // sido gravado — sobrescrever sem checar reverteria um estorno; (2) pode
  // trazer dados MELHORES que os já gravados — ex. a 1ª notificação era
  // `pending` sem taxa (`incomplete: true`) e esta é `approved` com taxa.
  // Por isso relê a linha atual e decide o patch a partir dela, em vez de
  // sobrescrever cegamente.
  const existing = await getPaymentByMpId(mpPaymentId);
  if (!existing) {
    console.error(
      "[webhooks/mercadopago] recordPayment reportou linha existente, mas não encontrei ao reler:",
      mpPaymentId,
    );
    return;
  }

  const patch: UpdatePaymentInput = {};
  if (shouldOverwriteStatus(existing.status, status)) {
    patch.status = status;
  }
  if (!incomplete) {
    // Esta notificação tem taxa determinável — sempre aplica (ela é, na
    // pior das hipóteses, tão boa quanto a que já estava gravada).
    patch.fee_cents = feeCents;
    patch.net_cents = netCents;
    patch.incomplete = false;
  } else if (existing.incomplete) {
    // Nem esta nem a gravada têm taxa — não há regressão possível, só
    // mantém `net = gross` (pode ter mudado se `transaction_amount`
    // divergir entre leituras, o que não deveria acontecer, mas não custa).
    patch.net_cents = netCents;
  }
  // `date_approved` pode ter estado ausente na 1ª notificação (ex.: ela
  // chegou `pending`) e `paidAt` ter caído no fallback de `date_created`;
  // uma reentrega já `approved` traz o valor definitivo.
  patch.paid_at = paidAt;

  await updatePayment(mpPaymentId, patch);
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

  // Tipo que não é nem `payment` nem `preapproval`: não tratamos, mas o
  // fato precisa ficar visível. Sem log, o modo de falha de "o MP passou a
  // mandar um topic novo/diferente" é silencioso — o console financeiro
  // fica vazio no fechamento do mês, sem nenhum sinal de que algo mudou.
  if (body.type !== "payment" && body.type !== "preapproval") {
    console.warn("[webhooks/mercadopago] tipo de notificação não tratado:", body.type);
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
