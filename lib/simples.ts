/**
 * Matemática do Simples Nacional — módulo puro.
 *
 * Sem banco, sem I/O e sem `new Date()`: o mês de referência entra como
 * parâmetro (via `mesesEmOperacao` e o array de receitas). Este projeto já
 * pagou caro por data lida de dentro da lógica, e imposto lido no fuso
 * errado cai no mês fiscal errado.
 *
 * O que ele produz é uma ESTIMATIVA do DAS, para o dono separar dinheiro. A
 * apuração que vale é a do PGDAS-D, feita pela contabilidade: ela ainda
 * segrega receitas, aplica sublimite municipal, retenções de ISS e o Fator R
 * do mês, nada disso modelado aqui.
 *
 * Fórmula (Resolução CGSN nº 140/2018, art. 21, inciso II — texto integral
 * conferido em 17/08/2026):
 *
 *     alíquota efetiva = (RBT12 × Aliq − PD) / RBT12
 *
 * onde RBT12 é a receita bruta acumulada nos doze meses anteriores ao
 * período de apuração, Aliq a alíquota nominal da faixa e PD a parcela a
 * deduzir da faixa. As faixas vivem em `lib/simples-tabela.ts`.
 *
 * Convenções de unidade — misturar isso é o jeito mais fácil de errar:
 *   - dinheiro: SEMPRE inteiro em centavos;
 *   - alíquota NOMINAL: inteiro em centésimos de % (600 = 6,00%);
 *   - alíquota EFETIVA: fração decimal (0,086 = 8,60%). É o único número
 *     não-inteiro que sai daqui, porque a divisão da fórmula quase nunca cai
 *     em dois decimais e arredondá-la jogaria erro pra dentro do DAS.
 */

import {
  LIMITE_SIMPLES_CENTS,
  NOMINAL_POR_FRACAO,
  SIMPLES_TABELA,
  type SimplesAnexo,
} from "@/lib/simples-tabela";

export type { SimplesAnexo };
export { LIMITE_SIMPLES_CENTS };

/**
 * Piso legal do divisor: "apenas para efeito de determinação das alíquotas
 * efetivas, quando a RBT12 (...) for igual a zero, considerar-se-á R$ 1,00"
 * (Resolução CGSN nº 140/2018, art. 21, parágrafo único). É o que impede a
 * divisão por zero no primeiro mês sem receita — e não é um hack nosso, é a
 * regra escrita.
 */
const RBT12_MINIMO_CENTS = 1_00;

/**
 * Até o 12º mês de atividade a receita é anualizada; do 13º em diante vale a
 * RBT12 de verdade (Resolução CGSN nº 140/2018, art. 22, § 4º: "a regra
 * prevista no § 3º até completar 12 meses de atividade" e "a regra prevista
 * no § 1º a partir do décimo terceiro mês de atividade").
 */
const ULTIMO_MES_ANUALIZADO = 12;

/** Quantos meses entram na RBT12 de uma empresa já madura. */
const MESES_RBT12 = 12;

export interface AliquotaEfetiva {
  /** Faixa da tabela do anexo, de 1 a 6. */
  faixa: number;
  /** Alíquota nominal da faixa, em centésimos de % (600 = 6,00%). */
  nominal: number;
  /** Parcela a deduzir da faixa, em centavos. */
  deduzir: number;
  /** Alíquota efetiva como FRAÇÃO decimal (0,086 = 8,60%). */
  efetiva: number;
}

function assertCentavos(valor: number, campo: string): void {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new RangeError(
      `${campo} deve ser inteiro >= 0 em centavos, recebido: ${valor}`,
    );
  }
}

/**
 * Receita bruta acumulada que determina a alíquota do mês de apuração, em
 * centavos.
 *
 * A empresa nova é o caso que importa aqui. A SYNQO abriu em 02/06/2026 e
 * não tem 12 meses de histórico; somar direto o que ela faturou até agora
 * joga a alíquota numa faixa BAIXA DEMAIS, e o erro sai caro no sentido
 * pior: o dono separa dinheiro de menos. A lei manda proporcionalizar (LC
 * 123/2006, art. 18, § 2º), e a Resolução CGSN nº 140/2018 diz como, no
 * art. 22:
 *
 *   § 2º  1º mês de atividade: RBT12 = receita do PRÓPRIO mês × 12.
 *   § 3º  meses 2 a 12:        RBT12 = média aritmética dos meses ANTERIORES × 12.
 *   § 1º  13º mês em diante:   RBT12 = soma dos 12 meses anteriores.
 *
 * Os §§ 2º e 3º são a mesma conta ("média dos meses que alimentam o cálculo
 * × 12") sobre conjuntos diferentes, e é por isso que os dois casos cabem
 * numa função só.
 *
 * @param monthlyGross Receitas brutas mensais, em centavos, do mês mais
 *   antigo para o mais recente. O QUE ENTRA AQUI MUDA COM `mesesEmOperacao`:
 *   - `mesesEmOperacao === 1`: exatamente 1 elemento — a receita do PRÓPRIO
 *     mês de apuração (§ 2º);
 *   - `mesesEmOperacao` de 2 a 12: exatamente `mesesEmOperacao - 1`
 *     elementos — os meses ANTERIORES ao de apuração, incluindo os que
 *     faturaram zero, porque a lei fala em média dos meses anteriores e um
 *     mês zerado omitido inflaria a média (§ 3º);
 *   - `mesesEmOperacao >= 13`: pelo menos 12 elementos; os 12 últimos são os
 *     que contam (§ 1º).
 *   Contagem errada estoura `RangeError` de propósito: para um número que
 *   existe para separar dinheiro, não ter número é melhor que ter um número
 *   baixo demais em silêncio.
 *
 * @param mesesEmOperacao Quantos meses de atividade a empresa terá completado
 *   NO mês de apuração, contando o próprio mês como 1. Fração de mês conta
 *   como mês inteiro: a SYNQO abriu em 02/06/2026, então junho/2026 é o mês 1
 *   e agosto/2026 é o mês 3. Quem chama calcula isso a partir da data de
 *   abertura — este módulo não olha calendário.
 */
export function rbt12(monthlyGross: number[], mesesEmOperacao: number): number {
  if (!Number.isInteger(mesesEmOperacao) || mesesEmOperacao < 1) {
    throw new RangeError(
      `mesesEmOperacao deve ser inteiro >= 1, recebido: ${mesesEmOperacao}`,
    );
  }
  monthlyGross.forEach((valor, i) => assertCentavos(valor, `monthlyGross[${i}]`));

  if (mesesEmOperacao > ULTIMO_MES_ANUALIZADO) {
    if (monthlyGross.length < MESES_RBT12) {
      throw new RangeError(
        `com ${mesesEmOperacao} meses de operação a RBT12 é a soma dos 12 meses ` +
          `anteriores, mas vieram só ${monthlyGross.length}`,
      );
    }
    return monthlyGross
      .slice(-MESES_RBT12)
      .reduce((soma, valor) => soma + valor, 0);
  }

  // No 1º mês o array traz o próprio mês; do 2º ao 12º traz os anteriores.
  const esperado = Math.max(1, mesesEmOperacao - 1);
  if (monthlyGross.length !== esperado) {
    throw new RangeError(
      `com ${mesesEmOperacao} ${mesesEmOperacao === 1 ? "mês" : "meses"} de ` +
        `operação esperava ${esperado} ${esperado === 1 ? "receita mensal" : "receitas mensais"}, ` +
        `recebeu ${monthlyGross.length}`,
    );
  }

  const soma = monthlyGross.reduce((acc, valor) => acc + valor, 0);
  // `Math.ceil` e não `Math.round`: a média × 12 pode cair no meio de um
  // centavo, e arredondar pra cima nunca empurra a RBT12 pra uma faixa mais
  // barata do que a devida. A diferença é de no máximo 1 centavo.
  return Math.ceil((soma * MESES_RBT12) / monthlyGross.length);
}

/**
 * Alíquota efetiva do mês, dada a RBT12 e o anexo.
 *
 * O anexo entra como PARÂMETRO porque não é constante: depende do Fator R
 * (folha ÷ receita bruta dos 12 meses anteriores), que muda mês a mês
 * conforme o pró-labore — >= 28% cai no Anexo III, abaixo disso no Anexo V.
 * Esta função não decide o anexo; ela obedece.
 */
export function aliquotaEfetiva(
  rbt12Cents: number,
  anexo: SimplesAnexo,
): AliquotaEfetiva {
  assertCentavos(rbt12Cents, "rbt12Cents");

  const tabela = SIMPLES_TABELA[anexo];
  if (!tabela) {
    throw new RangeError(`anexo desconhecido: ${String(anexo)}`);
  }

  const base = rbt12Cents === 0 ? RBT12_MINIMO_CENTS : rbt12Cents;

  // Acima de R$ 4.800.000,00 a empresa está fora do Simples e o número
  // perde o sentido; cair na última faixa (a mais cara) erra pra cima em vez
  // de devolver `undefined` e estourar em quem chama.
  const faixa =
    tabela.find((f) => base <= f.ateCents) ?? tabela[tabela.length - 1];

  const efetiva =
    ((base * faixa.nominal) / NOMINAL_POR_FRACAO - faixa.deduzirCents) / base;

  return {
    faixa: faixa.faixa,
    nominal: faixa.nominal,
    deduzir: faixa.deduzirCents,
    efetiva,
  };
}

/**
 * DAS estimado do mês, em centavos.
 *
 * @param receitaMesCents Receita bruta DO MÊS de apuração (não a RBT12).
 * @param aliquotaEfetiva Fração decimal — o campo `efetiva` devolvido por
 *   `aliquotaEfetiva()`, não a nominal em centésimos de %.
 */
export function dasEstimado(
  receitaMesCents: number,
  aliquotaEfetiva: number,
): number {
  assertCentavos(receitaMesCents, "receitaMesCents");
  if (
    !Number.isFinite(aliquotaEfetiva) ||
    aliquotaEfetiva < 0 ||
    aliquotaEfetiva > 1
  ) {
    throw new RangeError(
      `aliquotaEfetiva deve ser fração entre 0 e 1 (0,086 = 8,60%), ` +
        `recebido: ${aliquotaEfetiva}`,
    );
  }
  return Math.round(receitaMesCents * aliquotaEfetiva);
}
