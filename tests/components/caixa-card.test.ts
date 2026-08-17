import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CaixaCard, type CaixaSummary } from "@/components/superadmin/CaixaCard";
import { formatBRL, formatBRLFull } from "@/lib/money";

/**
 * `CaixaCard` é o número que o contador COPIA para dentro de uma NFS-e. Não
 * há navegador nesta sessão, então a verificação é feita no HTML que o
 * componente produz — que é exatamente o que o navegador receberia. Mesma
 * técnica de `tests/lib/finance-config.test.ts` para o `ImpostoCard`:
 * `renderToStaticMarkup`, porque o card é Server Component puro (sem estado,
 * sem efeito).
 *
 * Este arquivo existe porque o card não era renderizado por teste NENHUM.
 * Trocar `formatBRLFull` por `formatBRL` nele — que arredonda para real
 * inteiro e já destruiu centavos em produção — mantinha a suíte inteira
 * verde, com R$ 249,90 virando "R$ 250" em Bruto, Taxa e Líquido.
 */

/** R$ 249,90 bruto, R$ 13,00 de taxa, R$ 236,90 líquido — todos com centavos. */
const CAIXA: CaixaSummary = {
  gross: 24990,
  fee: 1300,
  netBeforeTax: 23690,
  incompletos: 0,
  estornos: 0,
  estornosCents: 0,
};

function render(caixa: CaixaSummary): string {
  return renderToStaticMarkup(
    createElement(CaixaCard, { competencia: "2026-08", caixa }),
  );
}

describe("CaixaCard — centavos chegam à tela", () => {
  /**
   * As três linhas, uma a uma. `formatBRLFull` produz "R$ 249,90" (com
   * espaço não-quebrável, vindo do `style: "currency"`); `formatBRL` produz
   * "R$ 250" com espaço comum. Comparar contra as DUAS funções é o que
   * transforma isto num teste de mutação: a asserção positiva prende a
   * formatação certa, e a negativa prova que a errada não está lá.
   */
  it("Bruto, Taxa e Líquido aparecem com centavos, nunca arredondados ao real", () => {
    const html = render(CAIXA);

    expect(html).toContain(formatBRLFull(24990)); // bruto
    expect(html).toContain(formatBRLFull(1300)); // taxa
    expect(html).toContain(formatBRLFull(23690)); // líquido

    // E nenhum dos três aparece na forma arredondada.
    expect(html).not.toContain(formatBRL(24990)); // "R$ 250"
    expect(html).not.toContain(formatBRL(1300)); // "R$ 13"
    expect(html).not.toContain(formatBRL(23690)); // "R$ 237"
  });

  it("o rótulo do líquido nunca é 'líquido' sozinho — imposto ainda não foi retido", () => {
    expect(render(CAIXA)).toContain("Líquido antes de imposto");
  });
});

/**
 * O ponto de IMPORTANT D: `incomplete` existia na tabela e nenhum componente
 * a lia. Um pagamento aprovado de R$ 249,90 com `fee_cents` nulo exibia
 * "Taxa − R$ 0,00" e "Líquido antes de imposto R$ 249,90" — o líquido
 * superestimado na taxa INTEIRA, sem marca nenhuma na tela, para um usuário
 * que copia esse número para dentro de uma nota fiscal.
 */
describe("CaixaCard — taxa desconhecida aparece onde o número aparece", () => {
  const COM_INCOMPLETO: CaixaSummary = {
    gross: 24990,
    fee: 0,
    netBeforeTax: 24990,
    incompletos: 1,
    estornos: 0,
    estornosCents: 0,
  };

  it("sem linha incompleta, nenhum aviso polui o card", () => {
    const html = render(CAIXA);
    expect(html).not.toContain("sem a taxa do Mercado Pago");
    expect(html).not.toContain("no máximo");
    expect(html).not.toContain("no mínimo");
  });

  it("com linha incompleta, o card avisa e diz quantas são", () => {
    const html = render(COM_INCOMPLETO);
    expect(html).toContain("sem a taxa do Mercado Pago");
    expect(html).toContain("1 pagamento");
  });

  /**
   * O aviso não pode ficar só numa nota de rodapé: o líquido em si precisa
   * estar qualificado, porque é ele que é copiado. "no máximo" no líquido e
   * "no mínimo" na taxa dizem a direção do erro — a taxa real só pode ser
   * maior, e o líquido real só pode ser menor.
   */
  it("a taxa é marcada como piso e o líquido como teto — a direção do erro fica explícita", () => {
    const html = render(COM_INCOMPLETO);
    expect(html).toContain("no mínimo"); // taxa
    expect(html).toContain("no máximo"); // líquido
  });

  it("o aviso vem ANTES dos números — o contador lê antes de copiar", () => {
    const html = render(COM_INCOMPLETO);
    const aviso = html.indexOf("sem a taxa do Mercado Pago");
    const liquido = html.indexOf("Líquido antes de imposto");
    expect(aviso).toBeGreaterThanOrEqual(0);
    expect(liquido).toBeGreaterThanOrEqual(0);
    expect(aviso).toBeLessThan(liquido);
  });

  it("plural concorda quando há mais de uma linha incompleta", () => {
    const html = render({ ...COM_INCOMPLETO, incompletos: 3 });
    expect(html).toContain("3 pagamentos");
  });
});

/**
 * ============================================================================
 * ESTORNO PRECISA APARECER — ele se subtrai sozinho, e em silêncio
 * ============================================================================
 *
 * Nenhum dos cinco blocos do console lista pagamentos individuais, exceto a
 * fila pendente. Um `refunded`/`charged_back` simplesmente DEIXA de ser somado
 * — no bruto, na taxa e na base da RBT12 — retroativamente, inclusive em
 * competência já apurada. Nada na tela dizia que a subtração aconteceu, e nada
 * lembrava que uma nota já emitida para aquela cobrança pode precisar de
 * cancelamento.
 *
 * Contar não muda número nenhum: os estornos continuam FORA do bruto e do
 * líquido. O que muda é o contador conseguir ver que existiram.
 */
describe("CaixaCard — estorno visível", () => {
  const COM_ESTORNO: CaixaSummary = {
    gross: 24990,
    fee: 1300,
    netBeforeTax: 23690,
    incompletos: 0,
    estornos: 2,
    estornosCents: 49980,
  };

  it("sem estorno no período, a linha não polui o card", () => {
    const html = render(CAIXA);
    expect(html).not.toContain("Estornado no período");
    expect(html).not.toContain("cancelamento");
  });

  it("com estorno, mostra quantidade e valor — e avisa sobre a nota já emitida", () => {
    const html = render(COM_ESTORNO);
    expect(html).toContain("Estornado no período (2)");
    expect(html).toContain(formatBRLFull(49980));
    // O que o contador precisa FAZER, não só saber.
    expect(html).toContain("cancelamento");
  });

  it("o valor estornado usa formatBRLFull — centavos sobrevivem", () => {
    // Comparar contra as DUAS funções é o que faz disto uma prova de mutação:
    // a positiva prende a formatação certa, a negativa mostra que a errada
    // ("R$ 500", de formatBRL) não está lá. Literal com espaço comum não
    // serviria — `Intl` emite espaço não-quebrável entre "R$" e o número.
    const html = render(COM_ESTORNO);
    expect(html).toContain(formatBRLFull(49980));
    expect(html).not.toContain(formatBRL(49980));
  });

  it("estorno NÃO entra no bruto nem no líquido — só é reportado ao lado", () => {
    const html = render(COM_ESTORNO);
    expect(html).toContain(formatBRLFull(24990));
    expect(html).toContain(formatBRLFull(23690));
  });
});
