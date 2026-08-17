import { describe, it, expect } from "vitest";
import {
  computeFeeAndNet,
  derivePaidAt,
  grossCentsOf,
  shouldOverwriteStatus,
} from "@/lib/mp-payment";

/**
 * `lib/mp-payment.ts` nasceu de uma extração: a matemática de taxa/líquido e
 * a regra de sobrescrita de status moravam dentro de
 * `app/api/webhooks/mercadopago/route.ts`, privadas do módulo. A
 * reconciliação (Task 9) precisa dos MESMOS números — e um `route.ts` do App
 * Router não pode exportar nada além dos handlers HTTP, então importar de lá
 * não era opção. Estes testes fixam o contrato do módulo extraído; os testes
 * do webhook (tests/api/webhook-pagamento.test.ts) continuam provando que o
 * caminho de produção usa exatamente este comportamento.
 */

describe("computeFeeAndNet", () => {
  it("prefere transaction_details.net_received_amount e deriva a taxa por gross - net", () => {
    const r = computeFeeAndNet(
      {
        transaction_details: { net_received_amount: 236.9 },
        // Deliberadamente absurdo — prova que não é lido quando há net.
        fee_details: [{ amount: 999 }],
      },
      24990,
    );
    expect(r).toEqual({ feeCents: 1300, netCents: 23690, incomplete: false });
  });

  it("sem net_received_amount, soma fee_details do collector", () => {
    const r = computeFeeAndNet({ fee_details: [{ amount: 12, fee_payer: "collector" }] }, 24990);
    expect(r).toEqual({ feeCents: 1200, netCents: 23790, incomplete: false });
  });

  it("ignora fee_details com fee_payer=payer — não é despesa nossa", () => {
    const r = computeFeeAndNet(
      {
        fee_details: [
          { amount: 12, fee_payer: "collector" },
          { amount: 5, fee_payer: "payer" },
        ],
      },
      24990,
    );
    expect(r).toEqual({ feeCents: 1200, netCents: 23790, incomplete: false });
  });

  it("fee_payer ausente conta como collector (o caso comum)", () => {
    const r = computeFeeAndNet({ fee_details: [{ amount: 12 }] }, 24990);
    expect(r.feeCents).toBe(1200);
  });

  it("sem taxa determinável: nunca inventa — net = gross e marca incomplete", () => {
    expect(computeFeeAndNet({}, 24990)).toEqual({
      feeCents: null,
      netCents: 24990,
      incomplete: true,
    });
    // Só taxa do pagador: depois do filtro sobra lista vazia — mesmo caso.
    expect(computeFeeAndNet({ fee_details: [{ amount: 5, fee_payer: "payer" }] }, 24990)).toEqual({
      feeCents: null,
      netCents: 24990,
      incomplete: true,
    });
  });

  it("arredonda com Math.round, não trunca (2.51 * 100 = 250.99999999999997)", () => {
    const r = computeFeeAndNet({ fee_details: [{ amount: 2.51 }] }, 1990);
    expect(r.feeCents).toBe(251);
    expect(r.netCents).toBe(1739);
  });
});

describe("shouldOverwriteStatus", () => {
  it("não deixa um approved atrasado reverter um refunded já gravado", () => {
    expect(shouldOverwriteStatus("refunded", "approved")).toBe(false);
    expect(shouldOverwriteStatus("chargeback", "approved")).toBe(false);
  });

  /**
   * `charged_back` — com underscore — é a grafia REAL do Mercado Pago
   * ("a chargeback was made in the buyer's credit card", doc de query-results).
   * `chargeback` sem underscore nunca chega numa notificação; ela existe aqui
   * porque é a grafia do comentário do schema (`lib/schema.ts`, coluna
   * `status`) e pode ter entrado em linha gravada à mão. As duas precisam
   * barrar a regressão: um estorno bancário revertido para `approved` é
   * receita contada sobre dinheiro que o banco já tirou de volta.
   */
  it("reconhece a grafia REAL do MP (`charged_back`, com underscore)", () => {
    expect(shouldOverwriteStatus("charged_back", "approved")).toBe(false);
    expect(shouldOverwriteStatus("approved", "charged_back")).toBe(true);
    expect(shouldOverwriteStatus("refunded", "charged_back")).toBe(true);
    expect(shouldOverwriteStatus("charged_back", "refunded")).toBe(true);
  });

  it("deixa um terminal negativo sobrescrever um approved", () => {
    expect(shouldOverwriteStatus("approved", "refunded")).toBe(true);
    expect(shouldOverwriteStatus("approved", "chargeback")).toBe(true);
  });

  it("deixa um terminal negativo virar outro (refunded -> chargeback)", () => {
    expect(shouldOverwriteStatus("refunded", "chargeback")).toBe(true);
  });

  it("permite a progressão normal pending -> approved", () => {
    expect(shouldOverwriteStatus("pending", "approved")).toBe(true);
  });
});

describe("grossCentsOf", () => {
  it("reais viram centavos com Math.round (19.9 * 100 = 1989.9999999999998)", () => {
    expect(grossCentsOf({ transaction_amount: 19.9 })).toBe(1990);
    expect(grossCentsOf({ transaction_amount: 249.9 })).toBe(24990);
  });

  it("valor ausente vira zero, não NaN", () => {
    expect(grossCentsOf({})).toBe(0);
  });
});

describe("derivePaidAt", () => {
  it("prefere date_approved", () => {
    expect(
      derivePaidAt({
        date_approved: "2026-08-15T12:00:00.000-03:00",
        date_created: "2026-08-15T11:00:00.000-03:00",
      }),
    ).toBe("2026-08-15T12:00:00.000-03:00");
  });

  it("cai para date_created quando o pagamento ainda não foi aprovado", () => {
    expect(derivePaidAt({ date_created: "2026-08-15T11:00:00.000-03:00" })).toBe(
      "2026-08-15T11:00:00.000-03:00",
    );
  });

  /**
   * `null`, e NÃO `new Date()`: o webhook pode usar "agora" como último
   * recurso (a linha vai existir de qualquer jeito), mas a reconciliação
   * precisa da data REAL para decidir a competência do pagamento — inventar
   * "agora" jogaria o pagamento no mês errado, em silêncio.
   */
  it("sem nenhuma data devolve null — a decisão do fallback é de quem chama", () => {
    expect(derivePaidAt({})).toBeNull();
  });
});
