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

import { instanteMs } from "@/lib/competencia";
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
  /**
   * ISO-8601 como o MP devolveu, COM offset (ex. `-03:00`). O offset é
   * significativo: ele é o que torna o carimbo um instante, e a competência
   * sai desse instante convertido para São Paulo (lib/competencia.ts). Vai
   * para `payments.paid_at`, que é `timestamptz` e honra o offset na escrita.
   */
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

/** Item que a importação tentou e não conseguiu. Nunca some em silêncio. */
export interface ItemFalha {
  mpPaymentId: string;
  motivo: string;
}

/** O que a rota devolve, no `dry` e na importação. */
export interface ReconciliacaoResultado extends Diferenca {
  competencia: string;
  /** `true` = nada foi gravado; a resposta é só o diff. */
  dry: boolean;
  /**
   * Pagamentos DA COMPETÊNCIA encontrados no MP. Vale a identidade
   * `encontradosMp = faltantes + divergentes + jaRegistrados + ignorados`,
   * para o "N encontrados · M já registrados" da tela fechar. Não é o total
   * bruto da janela consultada: essa janela é de propósito mais larga que a
   * competência (ver `buscarNoMp` na rota).
   */
  encontradosMp: number;
  ignorados: ItemIgnorado[];
  /**
   * Amarra a confirmação ao conjunto que foi mostrado. O `dry` devolve o
   * token do diff que apareceu na tela; a importação só grava se o diff
   * recalculado na hora ainda tiver o mesmo. Ver `assinaturaDiferenca`.
   */
  token: string;
  /** Sempre 0 no `dry`. Quantas linhas novas o INSERT criou de fato. */
  importados: number;
  /** Sempre 0 no `dry`. Quantos status foram corrigidos. */
  atualizados: number;
  /** Itens que a importação tentou e falhou — o lote segue, o fato aparece. */
  falhas: ItemFalha[];
  /** Quanto ficou para a próxima rodada por causa do teto por execução. */
  naoProcessados: number;
  /**
   * Itens que a rodada TOCOU e decidiu não gravar: a linha já existia, ou
   * `shouldOverwriteStatus` recusou sobrescrever um estado terminal.
   *
   * Separado de `naoProcessados` porque os dois pedem ações OPOSTAS do
   * operador: o teto pede rodar de novo, o pulado diz que não há o que fazer.
   * Antes os dois viravam a mesma mensagem, redigida como se o teto sempre
   * tivesse sido a causa.
   */
  pulados: number;
}

/**
 * O pagamento pertence a esta competência? Recorte SEMIABERTO `[from, to)` —
 * exatamente o de `listPaymentsByPeriod` (lib/db/payments.ts), que usa `gte`
 * embaixo e `lt` em cima.
 *
 * ============================================================================
 * ESTA FUNÇÃO JÁ COMPAROU RELÓGIO DE PAREDE. AGORA COMPARA INSTANTE.
 * ============================================================================
 *
 * A versão anterior IGNORAVA o offset de propósito, e o argumento registrado
 * era bom: `payments.paid_at` era `timestamp` **sem** time zone, o Postgres
 * descartava o offset ao gravar, e o invariante que protege esta rota não é
 * "é São Paulo", é "não existe uma segunda opinião sobre em que mês a linha
 * está". Colar no banco, mesmo torto, era melhor que divergir dele.
 *
 * Esse argumento dependia de uma premissa que caiu: a causa-raiz estava fora
 * de escopo. Ela foi consertada — `paid_at` agora é `timestamptz` e guarda o
 * INSTANTE, e a competência é decidida convertendo para `America/Sao_Paulo`
 * num lugar só (lib/competencia.ts). Com o banco guardando instante, comparar
 * relógio de parede é que criaria a segunda opinião.
 *
 * O risco residual que a versão antiga carregava e esta elimina: se o MP
 * mandasse `Z` em vez de `-03:00`, o relógio de parede deslizava 3 h e NADA
 * sinalizava — justamente porque os dois lados concordavam no erro. Hoje o
 * offset é lido e honrado, então as duas grafias do mesmo instante caem no
 * mesmo mês.
 *
 * O que continua valendo, e é o motivo de o recorte existir: um pagamento que
 * caísse do lado errado da fronteira sumiria de TODAS as categorias — nem
 * faltante, nem já registrado —, e a tela diria "Tudo conferido" com o mês
 * faturando a menos.
 *
 * `instanteMs` devolve `null` para carimbo sem offset — que não designa
 * instante nenhum. Quem chama trata isso como dado ilegível, não como "fora
 * da competência": ver a rota, que o manda para `ignorados`.
 */
export function dentroDaCompetencia(paidAt: string, fromISO: string, toISO: string): boolean {
  const t = instanteMs(paidAt);
  const from = instanteMs(fromISO);
  const to = instanteMs(toISO);
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

/**
 * Texto canônico do conjunto que a tela mostrou — o que a confirmação
 * realmente confirma.
 *
 * Sem isto, o operador confirma um NÚMERO, não um conjunto: a importação
 * refaria busca e classificação do zero e gravaria o que encontrasse naquele
 * instante. Para `faltantes` seria inócuo (o `UNIQUE` e o `getPaymentByMpId`
 * barram o duplicado). Para `divergentes` não: um estorno que chegasse entre
 * as duas etapas teria o status gravado sem ninguém ter visto — a rota
 * escreveria uma decisão que o operador nunca tomou.
 *
 * Entram a competência e, de cada item, o id e a TRANSIÇÃO exata. Ordenado
 * para não depender da ordem em que o MP paginou. `jaRegistrados` e
 * `ignorados` ficam de fora de propósito: eles não geram escrita, e mudança
 * neles não deveria invalidar uma confirmação legítima.
 */
export function assinaturaDiferenca(competencia: string, diff: Diferenca): string {
  const linhas = [
    ...diff.faltantes.map((f) => `+${f.mpPaymentId}:${f.status}:${f.grossCents}`),
    ...diff.divergentes.map((d) => `~${d.mpPaymentId}:${d.statusLocal}>${d.status}`),
  ].sort();
  return [competencia, ...linhas].join("|");
}
