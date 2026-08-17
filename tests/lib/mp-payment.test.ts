import { describe, it, expect } from "vitest";
import {
  computeFeeAndNet,
  derivePaidAt,
  grossCentsOf,
  shouldOverwriteStatus,
  TERMINAL_NEGATIVE_STATUSES,
} from "@/lib/mp-payment";
import { PAYMENT_STATUSES } from "@/lib/constants";

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

  /**
   * `typeof net === "number"` aceitava ZERO, e zero é o valor que o MP põe no
   * campo enquanto o líquido ainda não foi liquidado. Um `approved` de
   * R$ 249,90 com `net_received_amount: 0` gravava `fee_cents: 24990`,
   * `net_cents: 0` e `incomplete: false` — taxa de 100% do bruto, marcada
   * como dado COMPLETO. É o oposto exato do que esta função promete.
   *
   * O invariante `bruto − taxa = líquido` fecha nos dois ramos (24990 − 24990
   * = 0), então ele não detecta nada aqui — a única defesa é recusar o número
   * implausível.
   *
   * A regra: o líquido do MP só é autoritativo dentro da faixa plausível
   * `0 < net <= gross`. Fora dela não inventamos taxa nenhuma — cai para
   * `fee_details` e, se nem isso houver, `incomplete: true`.
   */
  describe("net_received_amount implausível não é dado completo", () => {
    it("net = 0 com bruto positivo não vira taxa de 100% — marca incomplete", () => {
      expect(computeFeeAndNet({ transaction_details: { net_received_amount: 0 } }, 24990)).toEqual({
        feeCents: null,
        netCents: 24990,
        incomplete: true,
      });
    });

    it("net = 0 mas com fee_details do collector: usa a taxa que existe", () => {
      const r = computeFeeAndNet(
        {
          transaction_details: { net_received_amount: 0 },
          fee_details: [{ amount: 12, fee_payer: "collector" }],
        },
        24990,
      );
      expect(r).toEqual({ feeCents: 1200, netCents: 23790, incomplete: false });
    });

    it("net negativo é recusado — nunca produz líquido negativo", () => {
      expect(computeFeeAndNet({ transaction_details: { net_received_amount: -5 } }, 24990)).toEqual({
        feeCents: null,
        netCents: 24990,
        incomplete: true,
      });
    });

    it("net maior que o bruto é recusado — taxa negativa não existe", () => {
      expect(
        computeFeeAndNet({ transaction_details: { net_received_amount: 300 } }, 24990),
      ).toEqual({ feeCents: null, netCents: 24990, incomplete: true });
    });

    /**
     * A fronteira do outro lado: taxa ZERO é legítima (cortesia, promoção),
     * e `net === gross` é a forma dela. Recusar isso junto com o zero
     * jogaria um dado bom pra `incomplete` sem motivo.
     */
    it("net igual ao bruto é taxa zero legítima, não implausível", () => {
      expect(
        computeFeeAndNet({ transaction_details: { net_received_amount: 249.9 } }, 24990),
      ).toEqual({ feeCents: 0, netCents: 24990, incomplete: false });
    });
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

/**
 * `PAYMENT_STATUSES` (lib/constants.ts) é o VOCABULÁRIO da coluna
 * `payments.status`. Ele estava descrevendo errado o dado que existe:
 * listava só `approved | refunded | chargeback`, mas o webhook grava
 * `String(payment.status)` — a grafia do MP, verbatim — e a grafia real do
 * chargeback lá é `charged_back`, com underscore. Desde a correção da
 * sobrescrita de status, é `charged_back` que entra tanto pelo webhook
 * quanto pela reconciliação.
 *
 * A constante é inerte hoje (`PaymentStatus` não tem consumidor), e é
 * justamente por isso que ela derivou sem ninguém notar. O teste abaixo a
 * amarra a uma lista que NÃO é inerte — `TERMINAL_NEGATIVE_STATUSES`, que
 * decide de verdade se um `approved` atrasado pode reverter um estorno.
 */
describe("PAYMENT_STATUSES × TERMINAL_NEGATIVE_STATUSES — vocabulário e regra não podem divergir", () => {
  it("todo status terminal negativo é um status conhecido do vocabulário", () => {
    for (const status of TERMINAL_NEGATIVE_STATUSES) {
      expect(PAYMENT_STATUSES).toContain(status);
    }
  });

  it("a grafia REAL do MP (`charged_back`) está no vocabulário", () => {
    expect(PAYMENT_STATUSES).toContain("charged_back");
  });

  /**
   * A grafia sem underscore continua no vocabulário de propósito: ela nunca
   * chega do MP, mas é a que o comentário do schema usa e a que uma linha
   * corrigida à mão no banco pode ter. Ver a docstring de
   * `TERMINAL_NEGATIVE_STATUSES`.
   */
  it("a grafia legada (`chargeback`) não foi removida — linha corrigida à mão ainda a usa", () => {
    expect(PAYMENT_STATUSES).toContain("chargeback");
  });

  /**
   * `pending` é o caso que prova que a lista precisa ir além dos três
   * originais: o webhook trata explicitamente a 1ª notificação chegando
   * `pending` (sem taxa) e a reentrega depois virando `approved`. Esse
   * valor está na coluna hoje.
   */
  it("inclui os status intermediários que o webhook de fato grava", () => {
    expect(PAYMENT_STATUSES).toContain("pending");
    expect(PAYMENT_STATUSES).toContain("rejected");
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
