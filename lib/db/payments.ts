import { and, desc, eq, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { db } from "./client";
import { payments, tenants, type PaymentRow } from "@/lib/schema";
import { getPlan } from "@/lib/plans";

/**
 * Camada de dados de `payments` — fonte da verdade sobre receita da
 * plataforma. Diferente do resto de `lib/db/*.ts`, estas funções NÃO
 * recebem `tenantId` e não filtram por tenant: pagamento é global, o
 * super-admin vê todos. Exceção deliberada à convenção tenant-scoped
 * descrita em `lib/db/index.ts` (mesmo espírito da exceção do marketplace).
 */

export interface RecordPaymentInput {
  tenant_id: number | null;
  tenant_name: string;
  tenant_document: string | null;
  plan: string | null;
  mp_payment_id: string;
  mp_preapproval_id: string | null;
  gross_cents: number;
  fee_cents: number | null;
  net_cents: number | null;
  status: string;
  paid_at: string;
  coupon_id: number | null;
  incomplete: boolean;
}

/** Allowlist do que pode ser gravado. Id e campos de NFS-e nunca vêm do input. */
const RECORD_FIELDS = [
  "tenant_id", "tenant_name", "tenant_document", "plan",
  "mp_payment_id", "mp_preapproval_id",
  "gross_cents", "fee_cents", "net_cents",
  "status", "paid_at", "coupon_id", "incomplete",
] as const;

function pickRecordFields(input: RecordPaymentInput): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const k of RECORD_FIELDS) {
    if (k in input) safe[k] = (input as unknown as Record<string, unknown>)[k];
  }
  return safe;
}

/**
 * Grava um pagamento. Idempotente pelo índice único em `mp_payment_id` —
 * webhook repetido e reconciliação usam o mesmo caminho sem duplicar.
 */
export async function recordPayment(input: RecordPaymentInput): Promise<{ created: boolean }> {
  const rows = await db
    .insert(payments)
    .values(pickRecordFields(input) as never)
    .onConflictDoNothing()
    .returning({ id: payments.id });
  return { created: rows.length > 0 };
}

/** Limites [início, fim) de uma competência 'YYYY-MM', em ISO. */
export function periodBounds(competencia: string): { from: string; to: string } {
  const [y, m] = competencia.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const to = new Date(Date.UTC(y, m, 1)).toISOString();
  return { from, to };
}

export async function listPaymentsByPeriod(competencia: string): Promise<PaymentRow[]> {
  // `to` é o `from` do mês seguinte (periodBounds é semiaberto [from, to)) —
  // por isso o limite superior é `lt`, não `lte`. Com `lte`, um pagamento no
  // instante exato da virada do mês contaria em dois períodos.
  const { from, to } = periodBounds(competencia);
  return db.select().from(payments)
    .where(and(gte(payments.paid_at, from), lt(payments.paid_at, to)))
    .orderBy(desc(payments.paid_at));
}

/** Caixa do período. Estorno e chargeback não entram. */
export async function sumCaixa(competencia: string) {
  const rows = await listPaymentsByPeriod(competencia);
  const ok = rows.filter((r) => r.status === "approved");
  const gross = ok.reduce((a, r) => a + r.gross_cents, 0);
  const fee = ok.reduce((a, r) => a + (r.fee_cents ?? 0), 0);
  return { gross, fee, netBeforeTax: gross - fee };
}

export async function listPendingNfse(): Promise<PaymentRow[]> {
  return db.select().from(payments)
    .where(and(eq(payments.status, "approved"), isNull(payments.nfse_issued_at)))
    .orderBy(desc(payments.paid_at));
}

export async function registerNfse(
  paymentId: number, numero: string, userId: number,
): Promise<PaymentRow | null> {
  const [row] = await db.update(payments)
    .set({
      nfse_number: numero,
      nfse_issued_at: sql`CURRENT_TIMESTAMP`,
      nfse_issued_by: userId,
    })
    .where(eq(payments.id, paymentId))
    .returning();
  return row ?? null;
}

/** Base do RBT12: bruto aprovado num intervalo. */
export async function sumGrossBetween(fromISO: string, toISO: string): Promise<number> {
  const rows = await db.select({ gross: payments.gross_cents, status: payments.status })
    .from(payments)
    .where(and(gte(payments.paid_at, fromISO), lte(payments.paid_at, toISO)))
    .orderBy(payments.paid_at);
  return rows.filter((r) => r.status === "approved").reduce((a, r) => a + r.gross, 0);
}

/**
 * Atualiza o status de um pagamento já registrado — é o caminho do
 * estorno. `recordPayment` usa `onConflictDoNothing`: uma notificação de
 * estorno para um `mp_payment_id` já existente seria descartada por ele, e
 * o pagamento contaria como receita para sempre. Esta função é o que
 * cumpre a regra "estorno muda o status, não vira delete".
 *
 * Idempotente: é um UPDATE puro por `mp_payment_id` (sem incremento nem
 * acúmulo), então aplicar duas vezes com o mesmo status devolve o mesmo
 * resultado. Devolve `null` se o `mp_payment_id` não existir — chamador
 * decide o que fazer (ex.: logar e seguir, não é o caminho comum).
 */
export async function updatePaymentStatus(
  mpPaymentId: string, status: string,
): Promise<PaymentRow | null> {
  const [row] = await db.update(payments)
    .set({ status })
    .where(eq(payments.mp_payment_id, mpPaymentId))
    .returning();
  return row ?? null;
}

/**
 * Lê a linha atual por `mp_payment_id`. Existe pro chamador (o webhook)
 * poder decidir COMO reagir a uma reentrega — ex.: recusar sobrescrever um
 * `refunded` com um `approved` atrasado, ou aproveitar dados melhores que
 * a notificação atual trouxe — decisão que exige saber o que já está
 * gravado, não só o que chegou agora.
 */
export async function getPaymentByMpId(mpPaymentId: string): Promise<PaymentRow | null> {
  const [row] = await db.select().from(payments)
    .where(eq(payments.mp_payment_id, mpPaymentId))
    .limit(1);
  return row ?? null;
}

/**
 * Allowlist do que uma reentrega pode tocar. Deliberadamente NÃO inclui
 * `tenant_id`/`tenant_name`/`plan`/`coupon_id`/`gross_cents`: são snapshot
 * do pagamento no momento em que ele foi criado e não devem mudar depois —
 * só o que uma notificação subsequente pode legitimamente corrigir (status,
 * taxa/líquido quando a primeira notificação não tinha, e a data efetiva).
 */
export interface UpdatePaymentInput {
  status?: string;
  fee_cents?: number | null;
  net_cents?: number | null;
  incomplete?: boolean;
  paid_at?: string;
}

/**
 * Aplica um patch parcial a uma linha já existente, por `mp_payment_id`.
 * Mais genérico que `updatePaymentStatus` — usado quando a reentrega de
 * uma notificação de pagamento traz mais do que só um status novo (ver
 * `getPaymentByMpId`). `updatePaymentStatus` continua existindo pro
 * caminho simples "só o status mudou".
 */
export async function updatePayment(
  mpPaymentId: string, patch: UpdatePaymentInput,
): Promise<PaymentRow | null> {
  const [row] = await db.update(payments)
    .set(patch)
    .where(eq(payments.mp_payment_id, mpPaymentId))
    .returning();
  return row ?? null;
}

export interface RecorrenciaSummary {
  mrrCents: number;
  ativosPorPlano: Record<string, number>;
  inadimplentes: number;
}

/**
 * Recorrência da base de assinantes — lê `tenants`, não `payments`: é sobre
 * quem assina AGORA (estado corrente da assinatura), não sobre o que entrou
 * de caixa num período. Por isso não recebe `competencia`.
 *
 * MRR usa o preço de tabela do plano corrente (lib/plans.ts), não o valor
 * historicamente pago — um tenant sem `plan` gravado (provisionado
 * manualmente) cai no Básico, mesmo fallback de `getPlan`.
 */
export async function getRecorrencia(): Promise<RecorrenciaSummary> {
  const rows = await db
    .select({ plan: tenants.plan, subscription_status: tenants.subscription_status })
    .from(tenants)
    .where(inArray(tenants.subscription_status, ["active", "past_due"]));

  const ativosPorPlano: Record<string, number> = {};
  let mrrCents = 0;
  let inadimplentes = 0;

  for (const row of rows) {
    if (row.subscription_status === "active") {
      const slug = row.plan ?? "basico";
      ativosPorPlano[slug] = (ativosPorPlano[slug] ?? 0) + 1;
      mrrCents += getPlan(row.plan).priceMonthly;
    } else if (row.subscription_status === "past_due") {
      inadimplentes += 1;
    }
  }

  return { mrrCents, ativosPorPlano, inadimplentes };
}
