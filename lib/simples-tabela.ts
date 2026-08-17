/**
 * Tabela de faixas do Simples Nacional — Anexos III e V.
 *
 * ============================================================================
 * FONTE E VIGÊNCIA — LEIA ANTES DE MEXER
 * ============================================================================
 *
 * Fonte normativa: Lei Complementar nº 123/2006, Anexos III e V, na redação
 * dada pela Lei Complementar nº 155/2016.
 *
 * Vigência dos valores abaixo: desde 1º de janeiro de 2018 (art. 11 da LC
 * 155/2016). Conferidos em 17/08/2026.
 *
 * Como foram conferidos: contra FONTE PRIMÁRIA, em 17/08/2026 — os 48
 * números (2 anexos × 6 faixas × limite inferior, limite superior, nominal e
 * parcela a deduzir) batem dígito a dígito com o texto consolidado da LC
 * 123/2006 no planalto.gov.br e com os PDFs oficiais da Resolução CGSN nº
 * 140/2018 em normas.receita.fazenda.gov.br. Nenhum valor veio de fonte
 * secundária.
 *
 * ARMADILHA PARA QUEM FOR RECONFERIR: o planalto.gov.br derruba a conexão de
 * cliente HTTP sem user-agent de navegador — foi o que fez a primeira
 * tentativa concluir, erradamente, que o texto legal era inalcançável. Com
 * `curl -A "<user-agent de navegador>"` a página abre normalmente (HTTP 200).
 *
 * A fórmula que consome esta tabela está no art. 18, § 1º-A da própria LC 123
 * — hierarquia superior à Resolução CGSN nº 140/2018 (art. 21, II), que a
 * repete. O fator R e seu operador (28% exatos caem no Anexo III) estão nos
 * §§ 5º-J e 5º-M do mesmo artigo, e o teto de R$ 4.800.000,00 no art. 3º, II.
 *
 * Confirmação cruzada embutida: `tests/lib/simples.test.ts` verifica que a
 * alíquota EFETIVA é contínua nas viradas da 1ª à 5ª faixa — o teto de cada
 * faixa e o piso da seguinte produzem a mesma alíquota efetiva. Isso não é
 * coincidência: as parcelas a deduzir são calibradas exatamente para isso.
 * Um dígito errado em qualquer `nominal` ou `deduzirCents` das faixas 1 a 5
 * quebra a continuidade e derruba o teste. É por isso que esta tabela NÃO
 * ganha um teste que repita seus valores: um teste assim só provaria que ela
 * foi digitada duas vezes.
 *
 * REFORMA TRIBUTÁRIA (LC 214/2025): o art. 519 SUBSTITUI os Anexos I a V da
 * LC 123/2006. Faixas e parcelas a deduzir seguem idênticas, e as faixas 1 a
 * 5 não mudam em nada — mas a alíquota NOMINAL da 6ª faixa muda já em 1º de
 * janeiro de 2027, não em 2029: Anexo III 33,00% → 32,90% e Anexo V 30,50% →
 * 30,40%, valendo em 2027 e 2028 e voltando aos valores atuais em 2029.
 *
 * RECONFERIR EM 1º/1/2027 — e note que o efeito prático aqui é nulo enquanto
 * a Synqo não chegar perto de R$ 3,6 milhões de RBT12, que é onde a 6ª faixa
 * começa. Nesse patamar este módulo já subestima de qualquer forma, porque o
 * ISS sai do DAS (ver ARMADILHA DA 6ª FAIXA abaixo).
 *
 * Em vigor em agosto de 2026: nada mudou. As Resoluções CGSN 190/2026 e
 * 191/2026, que integram IBS/CBS ao Simples, só produzem efeitos a partir de
 * 1º/1/2027; a CGSN 140/2018 segue como norma base.
 *
 * QUEM ATUALIZAR ESTA TABELA: troque os números, atualize a data de
 * conferência acima e rode a suíte. A continuidade é a rede de segurança.
 *
 * ============================================================================
 * ARMADILHA DA 6ª FAIXA
 * ============================================================================
 *
 * Da 5ª para a 6ª faixa a alíquota efetiva CAI (Anexo III: 17,51% → 15,00%;
 * Anexo V: 21,275% → 15,50%). Não é erro de digitação: na 6ª faixa o ISS sai
 * do DAS e passa a ser recolhido à parte, direto ao município, então a guia
 * unificada fica menor enquanto o imposto total do mês fica MAIOR. Ou seja,
 * acima de R$ 3.600.000,00 de RBT12 a estimativa deste módulo passa a
 * SUBESTIMAR o imposto do mês, porque cobre só o DAS.
 *
 * Na prática isso está fora do alcance da SYNQO por ordens de grandeza, mas
 * quem for exibir o número perto desse teto precisa saber.
 */

/**
 * Qual anexo se aplica é decidido mês a mês pelo Fator R (folha ÷ receita
 * bruta, ambos dos 12 meses anteriores): >= 28% cai no Anexo III, abaixo
 * disso no Anexo V (LC 123/2006, art. 18, §§ 5º-J e 5º-M). Como o pró-labore
 * muda, o anexo muda junto — por isso ele entra como PARÂMETRO em
 * `aliquotaEfetiva`, e não como constante deste módulo.
 *
 * Os Anexos I, II e IV existem, mas ficam de fora: I e II são comércio e
 * indústria, e IV é construção/limpeza/vigilância. A SYNQO presta serviço de
 * TI (item 1.05 da lista da LC 116/2003), que é III ou V conforme o Fator R.
 */
export type SimplesAnexo = "III" | "V";

export interface FaixaSimples {
  /** Número da faixa na tabela, de 1 a 6. */
  faixa: number;
  /**
   * Teto da faixa de RBT12, em centavos, INCLUSIVE — a lei escreve
   * "até R$ 180.000,00" e a faixa seguinte começa em "R$ 180.000,01".
   */
  ateCents: number;
  /** Alíquota nominal em centésimos de % — 600 = 6,00%, 1120 = 11,20%. */
  nominal: number;
  /** Parcela a deduzir, em centavos. */
  deduzirCents: number;
}

/**
 * A unidade de `nominal`: centésimos de % (mesma convenção de
 * `commission_pct` em lib/commission.ts). Vive aqui para que a conversão
 * apareça uma vez só, nomeada, em vez de um `10000` solto no meio da conta.
 */
export const NOMINAL_POR_FRACAO = 10_000;

/**
 * ANEXO III — Locação de bens móveis e prestação de serviços.
 * Aplica-se quando o Fator R é >= 28%.
 */
const ANEXO_III: readonly FaixaSimples[] = [
  { faixa: 1, ateCents: 180_000_00, nominal: 600, deduzirCents: 0 },
  { faixa: 2, ateCents: 360_000_00, nominal: 1120, deduzirCents: 9_360_00 },
  { faixa: 3, ateCents: 720_000_00, nominal: 1350, deduzirCents: 17_640_00 },
  { faixa: 4, ateCents: 1_800_000_00, nominal: 1600, deduzirCents: 35_640_00 },
  { faixa: 5, ateCents: 3_600_000_00, nominal: 2100, deduzirCents: 125_640_00 },
  { faixa: 6, ateCents: 4_800_000_00, nominal: 3300, deduzirCents: 648_000_00 },
];

/**
 * ANEXO V — Prestação de serviços sujeitos ao Fator R.
 * Aplica-se quando o Fator R é < 28%.
 */
const ANEXO_V: readonly FaixaSimples[] = [
  { faixa: 1, ateCents: 180_000_00, nominal: 1550, deduzirCents: 0 },
  { faixa: 2, ateCents: 360_000_00, nominal: 1800, deduzirCents: 4_500_00 },
  { faixa: 3, ateCents: 720_000_00, nominal: 1950, deduzirCents: 9_900_00 },
  { faixa: 4, ateCents: 1_800_000_00, nominal: 2050, deduzirCents: 17_100_00 },
  { faixa: 5, ateCents: 3_600_000_00, nominal: 2300, deduzirCents: 62_100_00 },
  { faixa: 6, ateCents: 4_800_000_00, nominal: 3050, deduzirCents: 540_000_00 },
];

export const SIMPLES_TABELA: Record<SimplesAnexo, readonly FaixaSimples[]> = {
  III: ANEXO_III,
  V: ANEXO_V,
};

/**
 * Teto de receita bruta anual do Simples Nacional (R$ 4.800.000,00) — que é,
 * por construção, o teto da última faixa. Derivado da tabela em vez de
 * redigitado, para não haver dois lugares a corrigir quando a lei mudar.
 *
 * Acima disso a empresa está fora do regime e a estimativa deste módulo
 * deixa de fazer sentido; quem exibe o número deve avisar em vez de mostrar.
 */
export const LIMITE_SIMPLES_CENTS =
  ANEXO_III[ANEXO_III.length - 1].ateCents;
