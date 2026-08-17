import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import MercadoPagoConfig, { Payment, PreApproval } from "mercadopago";
import {
  getPaymentByMpId, getTenantById, recordPayment, setTenantSubscriptionState, updatePayment,
  type UpdatePaymentInput,
} from "@/lib/db";
import { notifyPaymentStatus } from "@/lib/email/notify";
import {
  computeFeeAndNet, derivePaidAt, grossCentsOf, shouldOverwriteStatus,
} from "@/lib/mp-payment";

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

  const grossCents = grossCentsOf(payment);
  const { feeCents, netCents, incomplete } = computeFeeAndNet(payment, grossCents);
  const mpPaymentId = String(payment.id ?? dataId);
  const status = String(payment.status ?? "");
  // `derivePaidAt` devolve `null` quando o recurso não traz data nenhuma. As
  // duas variáveis ficam separadas de propósito: `paidAtDoMp` é um FATO sobre
  // o pagamento, `paidAt` pode ser o relógio desta máquina. Só o INSERT aceita
  // o fallback — gravar a linha com carimbo aproximado é melhor que perder a
  // notificação; o UPDATE não aceita (ver mais abaixo). A reconciliação
  // escolhe o oposto (ver lib/mp-payment.ts).
  //
  // `new Date().toISOString()` é UTC com `Z` explícito, e a coluna é
  // `timestamptz`: o instante é gravado sem ambiguidade, e a competência sai
  // depois convertendo para São Paulo (lib/competencia.ts).
  const paidAtDoMp = derivePaidAt(payment);
  const paidAt = paidAtDoMp ?? new Date().toISOString();

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

  // Uma notificação só tem AUTORIDADE sobre a linha quando não é uma reentrega
  // fora de ordem — a mesma condição que libera o `status`. Ela governa também
  // o `paid_at`, logo abaixo.
  const temAutoridade = shouldOverwriteStatus(existing.status, status);

  const patch: UpdatePaymentInput = {};
  if (temAutoridade) {
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
  // `paid_at` é SNAPSHOT, com o mesmo peso de `gross_cents` (que a allowlist
  // de `UpdatePaymentInput` já exclui por ser snapshot): ele decide a
  // competência, o mês do DAS e o mês da NFS-e. Antes esta linha era
  // incondicional, e QUALQUER notificação podia movê-lo — inclusive as duas
  // que não deveriam:
  //
  //  1. a REENTREGA FORA DE ORDEM. O handler já recusa o `status` dela (um
  //     `approved` atrasado não desfaz um `refunded` gravado), mas deixava a
  //     mesma notificação reescrever a data — ou seja, recusava a decisão e
  //     aceitava a consequência dela. Uma nota já emitida na competência certa
  //     via o pagamento migrar de mês por baixo;
  //  2. a notificação SEM DATA do MP, cujo `paidAt` é o relógio DESTA máquina.
  //     Isso não é um fato sobre o pagamento: um retry processado às 00:30 do
  //     dia 1º jogaria para a competência seguinte um pagamento do mês passado.
  //
  // Sobra o caso legítimo, que é o motivo de a sobrescrita existir: a 1ª
  // notificação chegou `pending` e gravou `date_created`; a reentrega chega
  // `approved` (logo, com autoridade) e traz o `date_approved` definitivo.
  if (temAutoridade && paidAtDoMp) {
    patch.paid_at = paidAtDoMp;
  }

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
