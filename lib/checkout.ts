import MercadoPagoConfig, { PreApproval, PreApprovalPlan } from "mercadopago";
import type { Plan } from "@/lib/plans";
import type { CouponRow, PartnerRow, TenantRow } from "@/lib/schema";
import { discountedPriceCents } from "@/lib/coupon-pricing";
import { tenantSiteUrl } from "@/lib/marketplace";
import { mpNotificationUrl } from "@/lib/platform";

function getMpClient() {
  return new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! });
}

/**
 * Os types do SDK (`PreApprovalRequest`/`PreApprovalPlanRequest`) não declaram
 * `notification_url` — mas a API REST de assinaturas aceita, e é ela que
 * sobrescreve a URL configurada no painel. (Os types de `payment`/`preference`
 * do mesmo SDK já declaram o campo; é uma lacuna dos de preapproval.)
 * Intersection estreita: acrescenta só o campo que falta, mantendo o resto do
 * payload tipado — `T & { notification_url }` continua atribuível a `T`.
 */
type WithNotificationUrl<T> = T & { notification_url: string };

type PreApprovalPlanBody = Parameters<PreApprovalPlan["create"]>[0]["body"];
type PreApprovalBody = Parameters<PreApproval["create"]>[0]["body"];

const DECLINE_MESSAGES: Record<string, string> = {
  cc_rejected_insufficient_amount: "Cartão sem saldo ou limite disponível. Tente outro cartão.",
  cc_rejected_bad_filled_security_code: "Código de segurança (CVV) inválido.",
  cc_rejected_bad_filled_date: "Data de validade inválida.",
  cc_rejected_bad_filled_card_number: "Número do cartão inválido.",
  cc_rejected_bad_filled_other: "Confira os dados do cartão e tente novamente.",
  cc_rejected_call_for_authorize: "Autorize a compra com o seu banco e tente de novo.",
  cc_rejected_card_disabled: "Cartão desabilitado. Ative-o com o banco ou use outro.",
  cc_rejected_high_risk: "Pagamento não autorizado. Tente outro cartão.",
  cc_rejected_max_attempts: "Muitas tentativas com este cartão. Tente mais tarde ou use outro.",
  cc_rejected_duplicated_payment: "Pagamento duplicado. Aguarde alguns minutos antes de tentar de novo.",
};
const GENERIC_DECLINE = "Cartão recusado. Verifique os dados ou tente outro cartão.";

export function translateDecline(statusDetail: string | null | undefined): string {
  return (statusDetail && DECLINE_MESSAGES[statusDetail]) || GENERIC_DECLINE;
}

/** Body de erro lançado pelo SDK do MP (parcial, defensivo). */
interface MpErrorShape {
  status?: number;
  message?: string;
  cause?: Array<{ code?: string | number; description?: string }>;
}

function extractStatusDetail(err: MpErrorShape): string | null {
  const code = err?.cause?.[0]?.code;
  return code != null ? String(code) : null;
}

/** 400/402 = recusa do cartão (não retentar). Demais (401/403 config/auth,
 *  408/429/5xx transitório, sem status) → re-throw; a rota devolve 502. A
 *  forma exata da recusa do MP é validada no sandbox (Task 8). */
function isDeclineError(err: MpErrorShape): boolean {
  return err?.status === 400 || err?.status === 402;
}

function subscriptionReason(plan: Plan, coupon: CouponRow | null): string {
  if (!coupon) return `AutoStand ${plan.name}`;
  if (coupon.discount_type === "percentage") return `AutoStand ${plan.name} — ${coupon.discount_value}% de desconto`;
  if (coupon.discount_type === "free_month") return `AutoStand ${plan.name} — 1º mês grátis`;
  return `AutoStand ${plan.name} — desconto especial`;
}

function autoRecurringBody(plan: Plan, coupon: CouponRow | null): Record<string, unknown> {
  const priceCents = coupon ? discountedPriceCents(plan, coupon) : plan.priceMonthly;
  const body: Record<string, unknown> = {
    frequency: 1,
    frequency_type: "months",
    transaction_amount: Math.max(1, priceCents) / 100, // piso de código; MP tem mínimo próprio
    currency_id: "BRL",
  };
  if (coupon?.discount_type === "free_month") {
    body.free_trial = { frequency: 1, frequency_type: "months" };
  }
  return body;
}

async function createMpPlan(tenant: TenantRow, plan: Plan, coupon: CouponRow | null): Promise<string> {
  const preApprovalPlan = new PreApprovalPlan(getMpClient());
  const body: WithNotificationUrl<PreApprovalPlanBody> = {
    reason: subscriptionReason(plan, coupon),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auto_recurring: autoRecurringBody(plan, coupon) as any,
    // Volta pro painel da PRÓPRIA loja (subdomínio ou custom_domain).
    // Usar o domínio da plataforma levaria a /admin num host sem tenant
    // (404 + sessão perdida, pois o cookie é host-only do subdomínio).
    back_url: `${tenantSiteUrl(tenant)}/admin/assinatura`,
    // Explícito no payload (não só no painel do MP): assim acompanha o deploy
    // e é verificável por teste. Vai pro APEX — é server-to-server e NÃO segue
    // o host do tenant, ao contrário do back_url acima. Ver mpNotificationUrl().
    notification_url: mpNotificationUrl(),
  };
  const newPlan = await preApprovalPlan.create({ body });

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

export interface TransparentSubscriptionResult {
  id: string | null;
  status: string;
  statusDetail: string | null;
  /** Mensagem pt-BR de recusa — presente só quando status === "rejected". */
  message?: string;
}

/**
 * Reconciliação anti-cobrança-dupla: procura uma assinatura já criada para o
 * tenant (external_reference) que esteja utilizável (authorized/pending). Serve
 * pro caso de timeout ambíguo — o MP criou a assinatura mas a resposta se perdeu
 * e o tenant foi liberado; no retry, reaproveitamos em vez de criar a 2ª.
 */
async function findReconcilableSubscription(
  preApproval: PreApproval,
  tenantId: number,
): Promise<TransparentSubscriptionResult | null> {
  const found = await preApproval.search({ options: { external_reference: String(tenantId) } });
  const usable = found.results?.find(
    (r) =>
      String(r.external_reference) === String(tenantId) &&
      (r.status === "authorized" || r.status === "pending"),
  );
  if (!usable?.id) return null;
  return { id: String(usable.id), status: String(usable.status), statusDetail: null };
}

/**
 * Checkout Transparente: cria o PreApproval direto via API com um card_token
 * tokenizado no navegador (Card Brick). O pagador não precisa de conta MP.
 * Retorna o status já resolvido (authorized/pending/rejected).
 */
export async function createTransparentSubscription(
  tenant: TenantRow,
  plan: Plan,
  coupon: CouponRow | null,
  cardToken: string,
  payerEmail: string,
): Promise<TransparentSubscriptionResult> {
  const preApproval = new PreApproval(getMpClient());

  const existing = await findReconcilableSubscription(preApproval, tenant.id);
  if (existing) return existing;

  const body: WithNotificationUrl<PreApprovalBody> = {
    reason: subscriptionReason(plan, coupon),
    external_reference: String(tenant.id),
    payer_email: payerEmail,
    card_token_id: cardToken,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auto_recurring: autoRecurringBody(plan, coupon) as any,
    back_url: `${tenantSiteUrl(tenant)}/admin/assinatura`,
    // Idem createMpPlan: explícito no payload e sempre no apex da plataforma.
    notification_url: mpNotificationUrl(),
    status: "authorized",
  };

  let res;
  try {
    res = await preApproval.create({
      body,
      requestOptions: { idempotencyKey: `sub-${tenant.id}` },
    });
  } catch (err) {
    const e = err as MpErrorShape;
    if (isDeclineError(e)) {
      const statusDetail = extractStatusDetail(e);
      return { id: null, status: "rejected", statusDetail, message: translateDecline(statusDetail) };
    }
    throw err; // transitório → a rota devolve 502
  }

  if (!res.id) throw new Error("MP did not return a preapproval id");
  const statusDetail = (res as { status_detail?: string }).status_detail ?? null;
  const status = String(res.status ?? "pending");
  const result: TransparentSubscriptionResult = { id: String(res.id), status, statusDetail };
  if (status === "rejected") result.message = translateDecline(statusDetail);
  return result;
}
