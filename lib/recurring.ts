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
 * seguinte.
 *
 * `to` é o TETO e vale para tudo — não existe motivo para derivar futuro
 * infinito.
 *
 * `from` é o piso de EXIBIÇÃO e vale só para o que já está pago ou ainda
 * não venceu. É ele que impede uma regra recém-cadastrada com vencimento
 * antigo de encher a tela de histórico irrelevante.
 *
 * O que este piso NÃO faz — e chegou a fazer, apagando dívida real da aba,
 * do badge, do banner e do cron de avisos — é esconder vencimento que já
 * passou e não foi pago. Isso é dinheiro devido; `buildBills` mostra
 * sempre, sem piso de data. A regra é simples: a janela recorta o que já
 * está resolvido, nunca o que está em aberto.
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
  /**
   * Regra desativada para de gerar vencimento FUTURO — e só isso. O que já
   * venceu e ficou sem pagar continua aparecendo (ver `buildBills`).
   */
  active: boolean;
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
 * Expande a regra em TODOS os vencimentos até o teto da janela — do
 * primeiro vencimento da série em diante, sem piso.
 *
 * O recorte do passado é decisão de `buildBills`, que sabe o que foi pago;
 * aqui não dá para decidir, e foi por tentar decidir sem essa informação
 * que ocorrência vencida e não paga sumia de vez. Este laço só produz o
 * calendário completo da regra.
 *
 * Termina sempre: `due` cresce monotonicamente e o laço para no primeiro
 * valor acima de `window.to`. A numeração da parcela é da série inteira,
 * não do trecho exibido.
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
    out.push({
      payable_id: rule.id,
      due_date: due,
      installment: rule.installments ? i + 1 : null,
      installments: rule.installments,
    });
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

/**
 * Uma ocorrência entra na lista quando:
 *
 * 1. venceu e não foi paga — SEMPRE. Sem piso de data e mesmo com a regra
 *    desativada. É dívida em aberto: tirar da tela não quita nada, só faz
 *    o lojista esquecer que deve. Vale para conta `unica` vencida há um
 *    ano, para a última parcela de uma série já encerrada e para a conta
 *    `anual` que passou meses fora da janela.
 * 2. ou está dentro da janela de exibição e a regra segue ativa — o caso
 *    normal: pagamentos recentes e próximos vencimentos.
 *
 * Fica de fora só o que está resolvido ou não existe: vencimento antigo já
 * pago (está no livro-caixa, repetir aqui é ruído) e qualquer vencimento
 * futuro de regra desativada — que é exatamente o que "desativar" promete
 * interromper.
 */
function isVisible(
  rule: PayableRule,
  due_date: string,
  paid: PaidRef | undefined,
  window: { from: string; to: string },
  today: string,
): boolean {
  if (!paid && due_date <= today) return true;
  if (!rule.active) return false;
  return due_date >= window.from;
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
      expandOccurrences(rule, window)
        .map((occ) => ({ occ, hit: byKey.get(`${occ.payable_id}:${occ.due_date}`) }))
        .filter(({ occ, hit }) => isVisible(rule, occ.due_date, hit, window, today))
        .map(({ occ, hit }): Bill => ({
          ...occ,
          status: classify(occ.due_date, hit, rule.payment_method, today),
          amount_cents: rule.amount_cents,
          paid_amount_cents: hit?.amount ?? null,
          transaction_id: hit?.transaction_id ?? null,
        })),
    )
    .sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : a.payable_id - b.payable_id));
}

/**
 * Teto da escalada de cobrança por e-mail: 12 semanas de atraso.
 *
 * Antes este teto existia por acidente — a ocorrência caía fora da janela
 * de derivação entre a 8ª e a 12ª semana de atraso (a semana exata
 * dependia do dia do mês) e o aviso morria junto com ela. Agora que dívida
 * vencida não tem mais piso, sem um teto explícito uma conta esquecida
 * viraria e-mail semanal para sempre.
 *
 * 84 dias é o MAIOR teto que o comportamento antigo já produzia: nenhum
 * aviso que era enviado antes deixa de ser enviado. A conta continua na
 * aba, no badge e no banner indefinidamente — o que para é a repetição do
 * e-mail, não a cobrança.
 */
export const MAX_OVERDUE_NOTICE_DAYS = 84;

/**
 * Qual estágio de aviso dispara hoje para este vencimento — ou null.
 *
 * Digest diário ingênuo repetiria "vence em 5 dias" cinco dias seguidos e
 * o lojista silenciaria o aviso. Cada conta aparece em D-3, D-0 e depois
 * a cada 7 dias de atraso, até MAX_OVERDUE_NOTICE_DAYS. Débito automático
 * recebe só o D-3: ele se paga sozinho, e cobrar depois geraria alarme
 * falso todo mês.
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
    if (late > MAX_OVERDUE_NOTICE_DAYS) return null;
    return late % 7 === 0 ? `atraso-${late}` : null;
  }
  return null;
}
