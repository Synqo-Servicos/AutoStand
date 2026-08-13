/**
 * Recorrência de contas a pagar — módulo PURO.
 *
 * Nada aqui toca banco, e "hoje" nunca é lido de `new Date()`: a data de
 * referência entra como parâmetro. Sem isso, o teste de 29 de fevereiro
 * quebraria sozinho em qualquer outro dia do ano.
 *
 * Datas são strings 'YYYY-MM-DD' e comparadas lexicograficamente — o que
 * é correto nesse formato e evita fuso horário por completo.
 */

function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Último dia do mês. `month` é 1-based. */
export function lastDayOfMonth(year: number, month: number): number {
  // Dia 0 do mês seguinte = último dia deste. Date.UTC usa mês 0-based,
  // então passar `month` (1-based) já aponta pro mês seguinte.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Soma meses preservando o dia, com clamp no último dia do mês de destino.
 *
 * SEMPRE calcular a partir da âncora original, nunca encadeando a partir
 * da ocorrência anterior: 31/01 + 1 = 28/02, mas 31/01 + 4 = 31/05.
 * Encadeando, o 28 de fevereiro contaminaria todos os meses seguintes.
 */
export function addMonthsClamped(iso: string, months: number): string {
  const { y, m, d } = parseISO(iso);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return toISO(ny, nm, Math.min(d, lastDayOfMonth(ny, nm)));
}

function toEpochDay(iso: string): number {
  const { y, m, d } = parseISO(iso);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Dias de `from` até `to`. Negativo quando `to` é anterior. */
export function daysBetween(from: string, to: string): number {
  return toEpochDay(to) - toEpochDay(from);
}

/**
 * Janela de derivação: do 1º dia de 2 meses atrás ao último dia do mês
 * seguinte. O piso é o que impede uma regra com vencimento antigo de
 * cuspir dezenas de "atrasados" fantasma no primeiro acesso.
 */
export function defaultWindow(today: string): { from: string; to: string } {
  const { y, m } = parseISO(today);
  const first = toISO(y, m, 1);
  const from = addMonthsClamped(first, -2);
  const { y: ny, m: nm } = parseISO(addMonthsClamped(first, 1));
  return { from, to: toISO(ny, nm, lastDayOfMonth(ny, nm)) };
}

export type BillStatus =
  | "pago"
  | "a_vencer"
  | "vence_hoje"
  | "atrasado"
  /** Débito automático vencido: o sistema não sabe se debitou. */
  | "aguardando_conciliacao";

export type NotifyStage = string; // 'd3' | 'd0' | 'atraso-7' | 'atraso-14' | …

export interface PayableRule {
  id: number;
  frequency: string;              // 'unica' | 'mensal' | 'anual'
  first_due_date: string;
  installments: number | null;
  payment_method: string | null;
  amount_cents: number | null;
}

export interface Occurrence {
  payable_id: number;
  due_date: string;
  installment: number | null;
  installments: number | null;
}

export interface PaidRef {
  payable_id: number;
  due_date: string;
  transaction_id: number;
  amount: number;
}

export interface Bill extends Occurrence {
  status: BillStatus;
  amount_cents: number | null;
  paid_amount_cents: number | null;
  transaction_id: number | null;
}

/**
 * Expande a regra nos vencimentos dentro da janela.
 *
 * Termina sempre: `due` cresce monotonicamente e o laço para no primeiro
 * valor acima de `window.to`. Ocorrências anteriores a `window.from` são
 * puladas mas contadas — a numeração da parcela é da série, não da janela.
 */
export function expandOccurrences(
  rule: PayableRule,
  window: { from: string; to: string },
): Occurrence[] {
  const step = rule.frequency === "anual" ? 12 : 1;
  const max = rule.frequency === "unica" ? 1 : (rule.installments ?? Number.POSITIVE_INFINITY);
  const out: Occurrence[] = [];

  for (let i = 0; i < max; i++) {
    const due = addMonthsClamped(rule.first_due_date, i * step);
    if (due > window.to) break;
    if (due >= window.from) {
      out.push({
        payable_id: rule.id,
        due_date: due,
        installment: rule.installments ? i + 1 : null,
        installments: rule.installments,
      });
    }
  }
  return out;
}

function classify(
  due_date: string,
  paid: PaidRef | undefined,
  payment_method: string | null,
  today: string,
): BillStatus {
  if (paid) return "pago";
  if (due_date > today) return "a_vencer";
  if (due_date === today) return "vence_hoje";
  return payment_method === "debito_automatico" ? "aguardando_conciliacao" : "atrasado";
}

/** Expande todas as regras, casa com as transações e classifica. */
export function buildBills(
  rules: PayableRule[],
  paid: PaidRef[],
  window: { from: string; to: string },
  today: string,
): Bill[] {
  const byKey = new Map(paid.map((p) => [`${p.payable_id}:${p.due_date}`, p]));

  return rules
    .flatMap((rule) =>
      expandOccurrences(rule, window).map((occ): Bill => {
        const hit = byKey.get(`${occ.payable_id}:${occ.due_date}`);
        return {
          ...occ,
          status: classify(occ.due_date, hit, rule.payment_method, today),
          amount_cents: rule.amount_cents,
          paid_amount_cents: hit?.amount ?? null,
          transaction_id: hit?.transaction_id ?? null,
        };
      }),
    )
    .sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : a.payable_id - b.payable_id));
}

/**
 * Qual estágio de aviso dispara hoje para este vencimento — ou null.
 *
 * Digest diário ingênuo repetiria "vence em 5 dias" cinco dias seguidos e
 * o lojista silenciaria o aviso. Cada conta aparece em D-3, D-0 e depois
 * a cada 7 dias de atraso. Débito automático recebe só o D-3: ele se paga
 * sozinho, e cobrar depois geraria alarme falso todo mês.
 */
export function stageForToday(
  due_date: string,
  payment_method: string | null,
  today: string,
): NotifyStage | null {
  const diff = daysBetween(today, due_date);
  if (diff === 3) return "d3";
  if (payment_method === "debito_automatico") return null;
  if (diff === 0) return "d0";
  if (diff < 0) {
    const late = -diff;
    return late % 7 === 0 ? `atraso-${late}` : null;
  }
  return null;
}
