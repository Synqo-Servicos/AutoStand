import { describe, it, expect } from "vitest";
import { avisoDaImportacao } from "@/components/superadmin/ReconciliarButton";

/**
 * Regressão da Task 9: a importação respondia 200 mesmo quando TODOS os itens
 * do lote falhavam, e a tela dava `toast.success("0 pagamentos importados.")`
 * — um visto verde para fracasso completo, com o bloco de falhas logo abaixo
 * contradizendo o próprio toast.
 *
 * O aviso é decidido por uma função PURA para poder ser provado sem
 * navegador: o componente só escolhe qual `toast.*` chamar a partir do
 * `tone`. O que este arquivo prende é a regra — nunca "verde" quando nada
 * entrou.
 */

/** Resultado mínimo de uma importação, com tudo zerado por padrão. */
function resultado(over: Partial<Parameters<typeof avisoDaImportacao>[0]> = {}) {
  return { importados: 0, atualizados: 0, falhas: [], naoProcessados: 0, pulados: 0, ...over };
}

describe("avisoDaImportacao — o tom acompanha o que de fato aconteceu", () => {
  it("FRACASSO TOTAL: nada entrou e tudo falhou — nunca é verde", () => {
    const aviso = avisoDaImportacao(
      resultado({ falhas: [{ mpPaymentId: "1" }, { mpPaymentId: "2" }] }),
    );
    expect(aviso.tone).toBe("error");
    expect(aviso.tone).not.toBe("success");
    // E o texto não pode ser a antiga contagem de importados, que dizia
    // "0 pagamentos importados." como se fosse um resultado normal.
    expect(aviso.texto).toContain("Nada foi importado");
    expect(aviso.texto).toContain("2 pagamentos falharam");
  });

  it("fracasso total de um item só concorda no singular", () => {
    const aviso = avisoDaImportacao(resultado({ falhas: [{ mpPaymentId: "1" }] }));
    expect(aviso.tone).toBe("error");
    expect(aviso.texto).toContain("1 pagamento falhou");
  });

  it("SUCESSO REAL: entrou e nada falhou", () => {
    const aviso = avisoDaImportacao(resultado({ importados: 3 }));
    expect(aviso.tone).toBe("success");
    expect(aviso.texto).toBe("3 pagamentos importados.");
  });

  it("sucesso de um item só concorda no singular", () => {
    expect(avisoDaImportacao(resultado({ importados: 1 })).texto).toBe("1 pagamento importado.");
  });

  /**
   * Correção de status é trabalho REALIZADO — a versão antiga contava só
   * `importados`, então um lote que corrigiu 2 estornos e não importou nada
   * anunciava "0 pagamentos importados.": tecnicamente verdade, e mesmo
   * assim a leitura errada do que aconteceu.
   */
  it("status corrigido conta como trabalho feito, não como lote vazio", () => {
    const aviso = avisoDaImportacao(resultado({ atualizados: 2 }));
    expect(aviso.tone).toBe("success");
    expect(aviso.texto).toBe("2 status corrigidos.");
  });

  it("importados e corrigidos aparecem juntos", () => {
    const aviso = avisoDaImportacao(resultado({ importados: 3, atualizados: 2 }));
    expect(aviso.tone).toBe("success");
    expect(aviso.texto).toBe("3 pagamentos importados · 2 status corrigidos.");
  });

  it("PARCIAL: entrou parte e parte falhou — nem verde nem vermelho", () => {
    const aviso = avisoDaImportacao(
      resultado({ importados: 2, falhas: [{ mpPaymentId: "9" }] }),
    );
    expect(aviso.tone).toBe("warning");
    expect(aviso.texto).toContain("2 pagamentos importados");
    expect(aviso.texto).toContain("1 pagamento falhou");
  });

  /**
   * Nada entrou e nada falhou: o teto por execução segurou o lote inteiro
   * para a próxima rodada. Não é erro, mas também não é sucesso — dizer
   * "importado" aqui seria a mesma mentira, em tom mais baixo.
   */
  it("nada entrou e nada falhou (teto por execução) não é sucesso", () => {
    const aviso = avisoDaImportacao(resultado({ naoProcessados: 5 }));
    expect(aviso.tone).toBe("info");
    expect(aviso.tone).not.toBe("success");
    // A afirmação central é o TOM: nada entrou, então nada de verde. O texto
    // exato passou a distinguir represado de pulado — ver o describe abaixo.
    expect(aviso.texto).toContain("Nada entrou");
  });
});

/**
 * "Nada entrou e nada falhou" tem duas causas OPOSTAS, e dizer a errada manda
 * o operador para o lado errado: se o teto por rodada segurou o lote, a saída
 * é rodar de novo; se os itens foram pulados de propósito — a linha já
 * existia, ou o estorno recusou virar `approved` outra vez —, não há o que
 * fazer. Antes as duas viravam "Nada foi importado nesta rodada.", redigido
 * como se o teto sempre tivesse sido a causa.
 */
describe("avisoDaImportacao — pulado não é o mesmo que represado", () => {
  it("tudo pulado: diz que já estava correto, e não manda conferir de novo", () => {
    const aviso = avisoDaImportacao(resultado({ pulados: 3 }));
    expect(aviso.tone).toBe("info");
    expect(aviso.texto).toContain("já estavam corretos");
    expect(aviso.texto).not.toContain("próxima");
  });

  it("teto atingido: diz quanto ficou para depois, e manda conferir de novo", () => {
    const aviso = avisoDaImportacao(resultado({ naoProcessados: 12 }));
    expect(aviso.tone).toBe("info");
    expect(aviso.texto).toContain("12");
    expect(aviso.texto).toContain("próxima");
    expect(aviso.texto).not.toContain("já estavam corretos");
  });

  it("singular concorda quando é um só", () => {
    expect(avisoDaImportacao(resultado({ pulados: 1 })).texto)
      .toContain("já estava correto");
  });
});
