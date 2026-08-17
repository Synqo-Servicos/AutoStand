/**
 * Reconciliação de pagamentos: o núcleo que compara o que o Mercado Pago tem
 * com o que o banco tem, e os tipos da resposta da rota.
 *
 * Módulo PURO — sem banco, sem `mercadopago`, sem `auth`, sem JSX. Duas
 * razões, as duas concretas:
 *
 * 1. É a parte que erra em silêncio (um recorte de período frouxo faz a tela
 *    oferecer importar um pagamento que já existe; um recorte apertado demais
 *    esconde um pagamento perdido) e precisa de teste sem Postgres.
 * 2. `app/api/superadmin/payments/reconciliar/route.ts` não pode exportar
 *    tipo nenhum — um `route.ts` do App Router só exporta handlers HTTP —, e
 *    o botão (`components/superadmin/ReconciliarButton.tsx`) precisa dos
 *    mesmos tipos da resposta. Sendo puro, o componente cliente pode importar
 *    daqui sem arrastar o SDK do MP nem o driver do Postgres para o bundle.
 *
 * Dinheiro em centavos inteiros, sempre.
 */

import { shouldOverwriteStatus } from "@/lib/mp-payment";

/**
 * Um pagamento que o MP devolveu, já traduzido para os campos que gravamos —
 * e já resolvido para um tenant nosso (quem não resolve vira `ItemIgnorado`,
 * nunca um candidato).
 */
export interface CandidatoMp {
  mpPaymentId: string;
  tenantId: number;
  /**
   * Snapshots do pagador no momento da importação. Existem porque
   * `payments.tenant_id` é SET NULL, nunca CASCADE: o registro fiscal
   * sobrevive à exclusão da loja, e sem estes campos ele sobreviveria anônimo.
   */
  tenantName: string;
  tenantDocument: string | null;
  plan: string | null;
  mpPreapprovalId: string | null;
  couponId: number | null;
  /** ISO-8601 como o MP devolveu (pode vir com offset, ex. `-03:00`). */
  paidAt: string;
  grossCents: number;
  status: string;
}

/** Pagamento que existe no MP e não existe no banco. */
export type ItemFaltante = CandidatoMp;

/** Existe nos dois lados, com status diferente — tipicamente estorno perdido. */
export interface ItemDivergente extends CandidatoMp {
  statusLocal: string;
}

/** Veio do MP mas não dá para gravar: fica visível em vez de sumir. */
export interface ItemIgnorado {
  mpPaymentId: string;
  grossCents: number;
  motivo: string;
}

export interface Diferenca {
  faltantes: ItemFaltante[];
  divergentes: ItemDivergente[];
  /** Quantos bateram exatamente — a parte saudável, que não vira ação. */
  jaRegistrados: number;
  /** Bruto que entraria se o operador confirmar a importação. */
  totalFaltanteCents: number;
}

/** O que a rota devolve, no `dry` e na importação. */
export interface ReconciliacaoResultado extends Diferenca {
  competencia: string;
  /** `true` = nada foi gravado; a resposta é só o diff. */
  dry: boolean;
  /** Quantos o MP devolveu na janela consultada, antes do recorte local. */
  consultadosMp: number;
  ignorados: ItemIgnorado[];
  /** Sempre 0 no `dry`. Quantas linhas novas o INSERT criou de fato. */
  importados: number;
  /** Sempre 0 no `dry`. Quantos status foram corrigidos. */
  atualizados: number;
}

/**
 * Campos de data/hora de um ISO-8601, com as faixas válidas no próprio regex
 * (mês 01–12, dia 01–31, hora 00–23...) — assim `"2026-13-01T..."` não vira
 * um `Date.UTC` que rola em silêncio para janeiro do ano seguinte. O offset
 * final (`-03:00`, `Z`, `+05:00`) é deliberadamente NÃO capturado.
 */
const RELOGIO_DE_PAREDE =
  /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])[T ]([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?(?:\.(\d{1,3})\d*)?/;

/**
 * O relógio de parede que o Postgres vai gravar, em ms — a chave de todo o
 * recorte de competência desta rota.
 *
 * `payments.paid_at` é `timestamp` **sem** time zone. Ao ler um literal com
 * offset, o Postgres **descarta o offset** e guarda o relógio de parede:
 * `'2026-08-31T22:00:00.000-03:00'` vira `2026-08-31 22:00:00`. Esta função
 * faz exatamente isso — lê os campos literais e ignora o offset — em vez de
 * `Date.parse`, que converteria para instante UTC.
 *
 * Devolve `null` para o que não é data reconhecível.
 */
export function relogioDeParedeMs(iso: string): number | null {
  const m = RELOGIO_DE_PAREDE.exec(iso.trim());
  if (!m) return null;
  const [, ano, mes, dia, hora, minuto, segundo, fracao] = m;
  const ms = fracao ? Number(fracao.padEnd(3, "0")) : 0;
  return Date.UTC(+ano, +mes - 1, +dia, +hora, +minuto, segundo ? +segundo : 0, ms);
}

/**
 * O pagamento pertence a esta competência? Recorte SEMIABERTO `[from, to)` —
 * exatamente o de `listPaymentsByPeriod` (lib/db/payments.ts), que usa `lt`
 * no limite de cima.
 *
 * A comparação é pelo RELÓGIO DE PAREDE dos dois lados, não pelo instante.
 * Esse é o ponto: o outro lado da comparação é o banco, e lá `paid_at` é
 * `timestamp` sem time zone. Um recorte por instante e o `WHERE` do Postgres
 * discordariam na janela das **21:00–23:59 do último dia do mês** (com o
 * offset `-03:00` que o MP manda), e a divergência não é cosmética:
 *
 *  1. na conferência do mês certo o pagamento sumiria de TODAS as categorias
 *     — nem faltante, nem já registrado —, e a tela diria "Tudo conferido"
 *     com o mês faturando a menos. É o modo de falha que esta rota existe
 *     para pegar;
 *  2. na conferência do mês seguinte viraria faltante fantasma, oferecido
 *     para importar todo mês e importando zero (o `UNIQUE` barra o INSERT);
 *  3. se de fato faltasse, entraria com `paid_at` do mês anterior — numa
 *     competência já fechada.
 *
 * Ignorar o offset (em vez de convertê-lo para São Paulo) é o que mantém este
 * filtro colado no banco em QUALQUER caso: enquanto o MP mandar `-03:00`, o
 * relógio de parede É o de São Paulo; se um dia mandar `Z`, o banco vai gravar
 * o relógio em UTC e este filtro vai concordar com ele — que é o que impede o
 * faltante fantasma. O que não pode existir é uma segunda opinião sobre em que
 * mês a linha está.
 */
export function dentroDaCompetencia(paidAt: string, fromISO: string, toISO: string): boolean {
  const t = relogioDeParedeMs(paidAt);
  const from = relogioDeParedeMs(fromISO);
  const to = relogioDeParedeMs(toISO);
  if (t === null || from === null || to === null) return false;
  return t >= from && t < to;
}

/** O mínimo que a classificação precisa de uma linha já gravada. */
interface LinhaLocal {
  mp_payment_id: string;
  status: string;
}

/**
 * Compara os dois lados. Três destinos possíveis para cada candidato:
 *
 * - não existe no banco → `faltantes` (webhook perdido);
 * - existe com outro status → `divergentes`, MAS só quando
 *   `shouldOverwriteStatus` autoriza. Um `approved` vindo do MP não pode ser
 *   oferecido para sobrescrever um `refunded` já gravado: a reconciliação lê
 *   o MP num instante qualquer e "consertaria" o estorno de volta para
 *   receita — o mesmo bug que o webhook já trava (ver lib/mp-payment.ts);
 * - existe e bate → só conta em `jaRegistrados`.
 */
export function classificarDiferenca(
  candidatos: readonly CandidatoMp[],
  locais: readonly LinhaLocal[],
): Diferenca {
  const porMpId = new Map(locais.map((l) => [l.mp_payment_id, l]));

  const faltantes: ItemFaltante[] = [];
  const divergentes: ItemDivergente[] = [];
  let jaRegistrados = 0;

  for (const c of candidatos) {
    const local = porMpId.get(c.mpPaymentId);
    if (!local) {
      faltantes.push(c);
      continue;
    }
    if (local.status !== c.status && shouldOverwriteStatus(local.status, c.status)) {
      divergentes.push({ ...c, statusLocal: local.status });
      continue;
    }
    jaRegistrados += 1;
  }

  return {
    faltantes,
    divergentes,
    jaRegistrados,
    totalFaltanteCents: faltantes.reduce((soma, f) => soma + f.grossCents, 0),
  };
}
