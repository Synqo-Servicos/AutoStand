/**
 * Configuração e aritmética de calendário do bloco de imposto do console.
 *
 * Módulo PURO de propósito — sem banco, sem `auth`, sem JSX. Ele existe para
 * que a parte do bloco de imposto que erra em silêncio (montagem do array de
 * meses e limites de consulta) seja testável sem subir Postgres.
 *
 * ============================================================================
 * A REGRA DE VISIBILIDADE (é o ponto desta task)
 * ============================================================================
 *
 * O console NÃO exibe valor de imposto até o contador validar o cálculo. Mas
 * quem valida é o contador, e ele tem login. Então a regra não é "esconder de
 * todo mundo", é **esconder de quem tomaria decisão errada com o número**:
 *
 *   | papel         | flag off                          | flag on |
 *   |---------------|-----------------------------------|---------|
 *   | `super_admin` | estado + insumos, SEM DAS/alíquota | tudo    |
 *   | `contador`    | tudo, marcado "não validado"      | tudo    |
 *
 * Ver `showsTaxValue`.
 */

import { isValidCompetencia } from "@/lib/competencia";
import { aliquotaEfetiva, dasEstimado, rbt12, type SimplesAnexo } from "@/lib/simples";
import type { ImpostoCardProps } from "@/components/superadmin/ImpostoCard";

// ============================================================================
// Configuração de ambiente
// ============================================================================

/**
 * `"true"`/`"1"` ligam; QUALQUER outra coisa (inclusive ausente, `"yes"`,
 * `"sim"`) deixa desligado. Allowlist e não denylist porque o modo de falha
 * de um valor não reconhecido tem que ser **esconder** o número, nunca
 * mostrá-lo por acidente de digitação.
 */
function parseBool(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === "true" || v === "1";
}

/**
 * Anexo do Simples aplicável à SYNQO. Não é constante da lei: depende do
 * Fator R mês a mês (ver `lib/simples-tabela.ts`), por isso vem do ambiente
 * em vez de hardcoded.
 *
 * Valor irreconhecível cai no default `"III"` — e o card **exibe o anexo
 * configurado** justamente para que um erro de digitação aqui seja visível
 * na tela em vez de virar um imposto errado em silêncio.
 */
function parseAnexo(raw: string | undefined): SimplesAnexo {
  const v = raw?.trim().toUpperCase();
  return v === "V" || v === "III" ? v : "III";
}

/** Anexo configurado (`FINANCE_ANEXO`), default `"III"`. */
export const FINANCE_ANEXO: SimplesAnexo = parseAnexo(process.env.FINANCE_ANEXO);

/**
 * O contador já validou o cálculo? (`FINANCE_TAX_VALIDATED`, default
 * `false`). Enquanto for `false`, o super-admin não vê valor de imposto.
 */
export const FINANCE_TAX_VALIDATED: boolean = parseBool(
  process.env.FINANCE_TAX_VALIDATED,
);

/**
 * O valor de imposto some para quem tomaria decisão com ele, e aparece
 * para quem tem qualificação para julgá-lo. O contador vê o cálculo ainda
 * não validado — é ele quem valida; o super-admin só vê depois do aval.
 */
export function showsTaxValue(role: string | undefined): boolean {
  if (role === "contador") return true;
  return FINANCE_TAX_VALIDATED;
}

// ============================================================================
// Calendário
// ============================================================================

/**
 * Competência de abertura da SYNQO SERVIÇOS LTDA — 02/06/2026. Fração de mês
 * conta como mês inteiro, então junho/2026 é o **mês 1** de operação (mesma
 * interpretação documentada em `rbt12`, `lib/simples.ts`).
 */
export const SYNQO_ABERTURA = "2026-06";

/** `YYYY-MM` → índice absoluto de mês, para somar/subtrair sem virar ano à mão. */
function mesIndex(competencia: string): number {
  if (!isValidCompetencia(competencia)) {
    throw new RangeError(`competência inválida: ${competencia}`);
  }
  const [y, m] = competencia.split("-").map(Number);
  return y * 12 + (m - 1);
}

/** Inverso de `mesIndex`. */
function indexMes(index: number): string {
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/**
 * Quantos meses de atividade a empresa terá completado NO mês de apuração,
 * contando o próprio mês como 1 — exatamente o `mesesEmOperacao` que
 * `rbt12` espera.
 *
 * Devolve `<= 0` para competência anterior à abertura (o picker do topo da
 * página aceita qualquer mês). Quem chama **precisa** tratar esse caso: um
 * `mesesEmOperacao` inválido faz `rbt12` estourar `RangeError`, e um
 * `RangeError` num Server Component derruba a página inteira.
 */
export function mesesEmOperacao(
  competencia: string,
  abertura: string = SYNQO_ABERTURA,
): number {
  return mesIndex(competencia) - mesIndex(abertura) + 1;
}

/**
 * Quantos meses entram na RBT12 de uma empresa madura — espelha `MESES_RBT12`
 * de `lib/simples.ts`, que é privado daquele módulo.
 */
const MESES_RBT12 = 12;

export interface PlanoRbt12 {
  /**
   * Competências a consultar no banco, da mais ANTIGA para a mais recente.
   * Nunca inclui o mês de apuração quando `usaMesDeApuracao` é `false`.
   */
  competencias: string[];
  /**
   * Quantos meses **zerados** entram ANTES das consultadas para fechar o
   * comprimento que `rbt12` exige. Só é > 0 do 14º mês em diante.
   */
  zerosAntes: number;
  /**
   * `true` apenas no 1º mês de atividade, quando o array é o PRÓPRIO mês de
   * apuração (Resolução CGSN nº 140/2018, art. 22, § 2º) e não os anteriores.
   * Nesse caso `competencias` vem vazio: quem chama já tem a receita do mês
   * corrente em mãos (é o "Bruto" do card de Caixa) e não precisa consultar
   * de novo.
   */
  usaMesDeApuracao: boolean;
}

/**
 * Monta o PLANO de consulta que alimenta `rbt12` — a parte que mais fácil se
 * erra em silêncio, isolada aqui para poder ser testada sem banco.
 *
 * `rbt12` tem guarda estrita de comprimento e estoura `RangeError` (que
 * derruba a página) se o array vier torto. A convenção dele, literal:
 *
 *   - `mesesEmOperacao === 1` → 1 elemento: o PRÓPRIO mês de apuração;
 *   - `mesesEmOperacao >= 2`  → exatamente `mesesEmOperacao - 1` elementos,
 *     todos ANTERIORES ao mês de apuração, **incluindo os zerados** (omitir
 *     um mês sem receita inflaria a média e o imposto sairia errado).
 *
 * Do 13º mês em diante `rbt12` soma só os 12 últimos elementos; os mais
 * antigos existem apenas para que a CONTAGEM prove que o mês de apuração
 * ficou de fora. Por isso, a partir do 14º mês, este plano consulta o banco
 * só dos 12 meses que efetivamente entram na soma e completa o resto com
 * zeros **à esquerda** (`zerosAntes`) — o número de queries fica limitado a
 * 12 por render em vez de crescer para sempre com a idade da empresa.
 *
 * Os zeros vão à ESQUERDA e não à direita: `rbt12` faz `slice(-12)`. Zero à
 * direita zeraria meses reais da janela que conta e desinflaria a RBT12; à
 * esquerda cai fora do `slice` e não muda soma nenhuma.
 */
export function planoRbt12(competencia: string, meses: number): PlanoRbt12 {
  if (!Number.isInteger(meses) || meses < 1) {
    throw new RangeError(`meses deve ser inteiro >= 1, recebido: ${meses}`);
  }

  if (meses === 1) {
    return { competencias: [], zerosAntes: 0, usaMesDeApuracao: true };
  }

  const anteriores = meses - 1;
  const consultados = Math.min(anteriores, MESES_RBT12);
  const zerosAntes = anteriores - consultados;

  const fim = mesIndex(competencia); // exclusivo: o mês de apuração não entra
  const competencias: string[] = [];
  for (let i = fim - consultados; i < fim; i++) {
    competencias.push(indexMes(i));
  }

  return { competencias, zerosAntes, usaMesDeApuracao: false };
}

/**
 * Limites de uma competência para `sumGrossBetween` (lib/db/payments.ts) —
 * que compara com `gte(from)` **e `lte(to)`**, inclusivo nos DOIS lados.
 *
 * Este é o motivo de a função existir em vez de reusar `periodBounds`:
 * `periodBounds` devolve o intervalo SEMIABERTO `[from, to)`, cujo `to` é o
 * primeiro instante do mês SEGUINTE. Passar aquele `to` direto para o `lte`
 * de `sumGrossBetween` faria um pagamento na virada exata do mês contar em
 * DOIS meses seguidos — e, dentro do array do RBT12, contar duas vezes na
 * mesma soma. O mesmo bug já foi corrigido uma vez neste projeto, em
 * `listPaymentsByPeriod`, que resolveu trocando `lte` por `lt`; aqui não dá
 * para mudar o operador (não tocamos `lib/db/payments.ts`), então o ajuste
 * vai no limite: `to` é o último instante que AINDA é deste mês.
 *
 * "Último instante" = 1 milissegundo antes da virada. É a granularidade real
 * do dado: `paid_at` vem do `date_approved` do Mercado Pago, ISO-8601 com
 * milissegundos. Um pagamento entre `23:59:59.999` e `00:00:00.000` (portanto
 * sub-milissegundo) escaparia das duas janelas — não existe pelo formato da
 * origem, mas fica registrado por honestidade.
 */
export function mesBoundsInclusivos(competencia: string): {
  from: string;
  to: string;
} {
  if (!isValidCompetencia(competencia)) {
    throw new RangeError(`competência inválida: ${competencia}`);
  }
  const [y, m] = competencia.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const proximoMes = Date.UTC(y, m, 1);
  const to = new Date(proximoMes - 1).toISOString();
  return { from, to };
}

/**
 * Vencimento do DAS da competência: dia 20 do mês SUBSEQUENTE (LC 123/2006,
 * art. 21, inciso III). Devolve `YYYY-MM-DD`.
 *
 * Não desloca para o próximo dia útil quando o dia 20 cai em fim de semana ou
 * feriado — isso exigiria calendário de feriados, que este projeto não tem. A
 * tela mostra "ou o próximo dia útil" junto da data, em vez de fingir
 * precisão que o dado não tem.
 */
export function vencimentoDas(competencia: string): string {
  const proximo = indexMes(mesIndex(competencia) + 1);
  return `${proximo}-20`;
}

// ============================================================================
// Montagem do bloco de imposto
// ============================================================================

/**
 * O que a página leu do banco para alimentar a RBT12. `brutoPorMes` vem na
 * MESMA ordem de `plano.competencias` (mais antigo → mais recente).
 */
export interface BaseRbt12 {
  meses: number;
  plano: PlanoRbt12;
  brutoPorMes: number[];
}

export interface ImpostoInput {
  competencia: string;
  /**
   * Bruto aprovado da competência — o mesmo número que o card de Caixa exibe.
   * É a receita do mês de apuração que entra no DAS (e, no 1º mês de operação,
   * também é o único elemento do array da RBT12).
   */
  receitaMesCents: number;
  /** Papel do usuário logado. Decide se o valor aparece — ver `showsTaxValue`. */
  role: string | undefined;
  /** `null` quando a competência é anterior à abertura da empresa. */
  base: BaseRbt12 | null;
}

/**
 * Aplica a regra de visibilidade aos números e devolve as props do card.
 *
 * Vive aqui, e não na página, por dois motivos: (1) é onde a decisão "esconde
 * ou mostra" encosta nos valores, e ela merece teste direto, sem banco nem
 * navegador; (2) mantém a página com I/O e JSX apenas.
 *
 * O corte de visibilidade é ANTES do cálculo: com o valor escondido, `DAS` e
 * alíquota não são só omitidos do JSX — não chegam a ser calculados, e a prop
 * que os carregaria (`valores`) é `null`. Como o card é Server Component, o
 * número não existe em lugar nenhum que o navegador alcance.
 */
export function montarImposto({
  competencia,
  receitaMesCents,
  role,
  base,
}: ImpostoInput): ImpostoCardProps {
  const comum = {
    competencia,
    anexo: FINANCE_ANEXO,
    aberturaCompetencia: SYNQO_ABERTURA,
    validado: FINANCE_TAX_VALIDATED,
  };

  if (!base) {
    return {
      ...comum,
      meses: mesesEmOperacao(competencia),
      rbt12Cents: null,
      janela: null,
      valores: null,
    };
  }

  const { meses, plano, brutoPorMes } = base;
  // O comprimento é o contrato de `rbt12`, e ele estoura `RangeError` se vier
  // torto: no 1º mês o array é o PRÓPRIO mês de apuração; do 2º em diante são
  // exatamente `meses - 1` meses ANTERIORES, zerados inclusive. Os zeros de
  // completude (14º mês em diante) vão à ESQUERDA, fora do `slice(-12)` da
  // soma — ver `planoRbt12`.
  const monthlyGross = plano.usaMesDeApuracao
    ? [receitaMesCents]
    : [...new Array<number>(plano.zerosAntes).fill(0), ...brutoPorMes];

  const rbt12Cents = rbt12(monthlyGross, meses);
  const janela = plano.usaMesDeApuracao
    ? { de: competencia, ate: competencia }
    : {
        de: plano.competencias[0],
        ate: plano.competencias[plano.competencias.length - 1],
      };

  if (!showsTaxValue(role)) {
    return { ...comum, meses, rbt12Cents, janela, valores: null };
  }

  const aliquota = aliquotaEfetiva(rbt12Cents, FINANCE_ANEXO);
  return {
    ...comum,
    meses,
    rbt12Cents,
    janela,
    valores: {
      efetiva: aliquota.efetiva,
      faixa: aliquota.faixa,
      dasCents: dasEstimado(receitaMesCents, aliquota.efetiva),
      vencimento: vencimentoDas(competencia),
    },
  };
}
