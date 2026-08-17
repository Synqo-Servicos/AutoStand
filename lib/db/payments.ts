import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";
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

/**
 * Uma linha cuja taxa do MP é DESCONHECIDA. Duas formas da mesma coisa: a
 * flag `incomplete` (posta por `computeFeeAndNet` quando o payload do MP não
 * permitiu derivar a taxa) e `fee_cents` nulo sem a flag — o que uma linha
 * gravada antes da coluna existir, ou corrigida à mão no banco, tem.
 *
 * As duas importam porque as duas caem no mesmo `?? 0` da soma abaixo, e
 * portanto inflam o líquido do mesmo jeito. Contar só pela flag deixaria
 * metade do problema invisível.
 */
function taxaDesconhecida(row: { fee_cents: number | null; incomplete: boolean }): boolean {
  return row.incomplete || row.fee_cents === null;
}

/**
 * Caixa do período. Estorno e chargeback não entram.
 *
 * `fee ?? 0` trata taxa DESCONHECIDA como taxa ZERO — o líquido sai
 * superestimado na taxa inteira. A linha não pode ser descartada (o bruto é
 * real e a competência precisa fechar), então o caixa devolve junto
 * `incompletos`: quantas linhas entraram assim. Quem exibe é obrigado a
 * dizer que aquele líquido é um TETO, não um valor — ver `CaixaCard`.
 * Este número é a única razão de a coluna `incomplete` existir.
 */
export async function sumCaixa(competencia: string) {
  const rows = await listPaymentsByPeriod(competencia);
  const ok = rows.filter((r) => r.status === "approved");
  const gross = ok.reduce((a, r) => a + r.gross_cents, 0);
  const fee = ok.reduce((a, r) => a + (r.fee_cents ?? 0), 0);
  const incompletos = ok.filter(taxaDesconhecida).length;
  return { gross, fee, netBeforeTax: gross - fee, incompletos };
}

/**
 * Status que gera NFS-e. Um só, e num lugar só: `listPendingNfse` (quem
 * MONTA a fila) e `registerNfse` (quem CARIMBA a linha) leem daqui, então
 * não podem divergir. A regra é "se um pagamento não pode entrar na fila,
 * ele também não pode ser carimbado" — se as duas condições fossem escritas
 * à mão em cada função, afrouxar uma e esquecer a outra reabriria
 * exatamente o buraco que este predicado fecha.
 */
const NFSE_STATUS_ELEGIVEL = "approved";

/** Predicado compartilhado de elegibilidade fiscal. Ver `NFSE_STATUS_ELEGIVEL`. */
function statusGeraNfse() {
  return eq(payments.status, NFSE_STATUS_ELEGIVEL);
}

export async function listPendingNfse(): Promise<PaymentRow[]> {
  return db.select().from(payments)
    .where(and(statusGeraNfse(), isNull(payments.nfse_issued_at)))
    .orderBy(desc(payments.paid_at));
}

/**
 * Lê a linha por id primário. Existe para a rota de NFS-e poder EXPLICAR
 * por que o carimbo não pegou: `registerNfse` devolve `null` para três
 * causas distintas (id inexistente, nota já registrada, status que não gera
 * nota) e uma única query com `RETURNING` não as separa. Só é chamada no
 * caminho de erro — o caminho feliz continua sendo uma query só.
 */
export async function getPaymentById(paymentId: number): Promise<PaymentRow | null> {
  const [row] = await db.select().from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);
  return row ?? null;
}

/**
 * Idempotente por desenho: só grava se `nfse_issued_at` ainda for NULL.
 * Sem essa condição no WHERE, um segundo registro no mesmo pagamento (duas
 * abas na fila, duplo clique) sobrescreveria em silêncio o vínculo "qual
 * nota foi emitida pra este pagamento" — a nota continua existindo na
 * prefeitura, mas o rastro dela aqui se perderia, e esse rastro é a razão
 * de estes campos existirem (Task 1).
 *
 * O `status` entra no WHERE pelo mesmo predicado que monta a fila
 * (`statusGeraNfse`). Sem ele, o WHERE era `id = ? AND nfse_issued_at IS
 * NULL`: uma sessão de `contador` — a credencial mais fraca com acesso a
 * esta rota — podia varrer os ids 1..N e carimbar TODA linha de `payments`,
 * inclusive `refunded`, `chargeback` e `pending`, que a fila nunca mostra.
 * A fila esvaziava e não havia caminho de volta (ver `clearNfse`).
 *
 * Devolve `null` quando o UPDATE não afeta nenhuma linha — id inexistente,
 * nota já registrada OU status que não gera nota não são distinguíveis aqui
 * (uma única query); o chamador usa `getPaymentById` para separar os três e
 * responder com a causa certa.
 */
export async function registerNfse(
  paymentId: number, numero: string, userId: number,
): Promise<PaymentRow | null> {
  const [row] = await db.update(payments)
    .set({
      nfse_number: numero,
      nfse_issued_at: sql`CURRENT_TIMESTAMP`,
      nfse_issued_by: userId,
    })
    .where(and(
      eq(payments.id, paymentId),
      statusGeraNfse(),
      isNull(payments.nfse_issued_at),
    ))
    .returning();
  return row ?? null;
}

/**
 * Desfaz o registro de NFS-e de um pagamento: limpa os três campos e
 * devolve a linha para a fila. É o inverso exato de `registerNfse`.
 *
 * Por que existe: `registerNfse` era a ÚNICA escrita em `nfse_*` no
 * sistema, então um número digitado errado — ou um carimbo em massa por
 * credencial abusada — era permanente, e a recuperação exigia acesso direto
 * ao Postgres de produção. Isto é o caminho mínimo de volta.
 *
 * Quem pode chamar NÃO é decidido aqui: a rota `DELETE` usa
 * `withSuperAdmin`, não `withFinanceAccess` — o `contador` carimba, mas não
 * descarimba. Ver app/api/superadmin/payments/[id]/nfse/route.ts.
 *
 * O `isNotNull` no WHERE mantém a simetria com `registerNfse`: sem ele, a
 * função devolveria 200 para pagamento que nunca teve nota, e o chamador
 * não teria como distinguir "desfiz" de "não havia nada a desfazer".
 */
export async function clearNfse(paymentId: number): Promise<PaymentRow | null> {
  const [row] = await db.update(payments)
    .set({
      nfse_number: null,
      nfse_issued_at: null,
      nfse_issued_by: null,
    })
    .where(and(eq(payments.id, paymentId), isNotNull(payments.nfse_issued_at)))
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
 *
 * É o caminho do estorno e o de correção de taxa: `recordPayment` usa
 * `onConflictDoNothing`, então uma notificação para um `mp_payment_id` já
 * existente seria descartada por ele e o pagamento contaria como receita
 * para sempre. Esta função é o que cumpre a regra "estorno muda o status,
 * não vira delete" — e, diferente de um update só de status, também aplica
 * a taxa/líquido que uma reentrega posterior trouxe (ver `getPaymentByMpId`).
 *
 * Idempotente: é um UPDATE puro por `mp_payment_id` (sem incremento nem
 * acúmulo), então aplicar o mesmo patch duas vezes converge no mesmo
 * resultado. Devolve `null` se o `mp_payment_id` não existir.
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
