import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RecorrenciaCard } from "@/components/superadmin/RecorrenciaCard";
import { formatBRL, formatBRLFull } from "@/lib/money";
import type { RecorrenciaSummary } from "@/lib/db/payments";

/**
 * Um MRR menor que o número de assinaturas ativas sugere, sem dizer por quê,
 * não é um número corrigido — é um número em que ninguém confia. Quem lê este
 * card sabe quantas lojas existem na base; se a conta não fecha e a tela não
 * explica, a conclusão natural é que o console está errado de novo.
 *
 * Por isso a correção do cálculo veio com a exclusão VISÍVEL, e por isso ela
 * tem teste: renderizar componente é justamente onde esta branch já deixou
 * duas mutações de formatador sobreviverem.
 */
const BASE: RecorrenciaSummary = {
  mrrCents: 24990,
  ativosPorPlano: { pro: 1 },
  inadimplentes: 0,
  cortesias: 0,
  suspensos: 0,
  semPlano: 0,
};

function render(over: Partial<RecorrenciaSummary> = {}): string {
  return renderToStaticMarkup(
    createElement(RecorrenciaCard, { recorrencia: { ...BASE, ...over } }),
  );
}

describe("RecorrenciaCard — o que ficou fora do MRR aparece", () => {
  it("base limpa: nenhuma linha de exceção polui o card", () => {
    const html = render();
    expect(html).not.toContain("Fora do MRR");
    expect(html).not.toContain("Cortesia");
    expect(html).not.toContain("Suspensas");
  });

  it("cortesia aparece nomeada, com o motivo", () => {
    const html = render({ cortesias: 2 });
    expect(html).toContain("Fora do MRR");
    expect(html).toContain("Cortesia");
    expect(html).toContain("cupom zera a mensalidade");
  });

  it("suspensa aparece — é o caso que gerou o relato", () => {
    const html = render({ suspensos: 3 });
    expect(html).toContain("Suspensas com assinatura ativa");
  });

  /**
   * Assinatura ativa sem plano é dado inconsistente, não uma categoria de
   * negócio: a tela precisa dizer que é para conferir o cadastro, senão vira
   * um número que se aceita e nunca se resolve.
   */
  it("sem plano aparece com aviso de inconsistência, não como categoria normal", () => {
    const html = render({ semPlano: 1 });
    expect(html).toContain("Ativas sem plano definido");
    expect(html).toContain("inconsistência de cadastro");
  });

  it("as três convivem quando todas existem", () => {
    const html = render({ cortesias: 1, suspensos: 2, semPlano: 3 });
    expect(html).toContain("Cortesia");
    expect(html).toContain("Suspensas com assinatura ativa");
    expect(html).toContain("Ativas sem plano definido");
  });

  /**
   * O MRR de uma base só de cortesias é R$ 0,01 — e `formatBRL` arredondaria
   * para "R$ 0". O centavo aqui não é detalhe: é a diferença entre "cedi
   * acesso" e "não cobro nada de ninguém".
   */
  it("o MRR usa formatBRLFull — R$ 0,01 não pode virar R$ 0", () => {
    const html = render({ mrrCents: 1, ativosPorPlano: { pro: 1 }, cortesias: 1 });
    expect(html).toContain(formatBRLFull(1));
    expect(html).not.toContain(formatBRL(1));
  });
});
