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
  /** Snapshot do pagador: `payments.tenant_id` é SET NULL, o nome sobrevive. */
  tenantName: string;
  tenantDocument: string | null;
  plan: string | null;
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
 * O pagamento pertence a esta competência? Recorte SEMIABERTO `[from, to)` —
 * exatamente o de `listPaymentsByPeriod` (lib/db/payments.ts), que usa `lt`
 * no limite de cima.
 *
 * Ter que repetir a regra aqui não é duplicação à toa: o filtro do banco roda
 * em SQL sobre a coluna `paid_at`, e este roda em JS sobre a data que o MP
 * devolveu. Se os dois discordarem, o pagamento da virada do mês aparece como
 * "faltando" para sempre — a cada reconciliação de agosto ele seria oferecido
 * de novo, porque o banco (com `lt`) nunca o conta como agosto.
 *
 * Comparação por INSTANTE (`Date.parse`), não por string: o MP devolve datas
 * com offset (`2026-08-31T22:00:00.000-03:00`), que ordenam diferente do
 * mesmo instante escrito em UTC.
 */
export function dentroDaCompetencia(paidAt: string, fromISO: string, toISO: string): boolean {
  const t = Date.parse(paidAt);
  if (Number.isNaN(t)) return false;
  return t >= Date.parse(fromISO) && t < Date.parse(toISO);
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
