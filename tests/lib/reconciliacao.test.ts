import { describe, it, expect } from "vitest";
import {
  classificarDiferenca,
  dentroDaCompetencia,
  type CandidatoMp,
} from "@/lib/reconciliacao";

/**
 * Núcleo da reconciliação, isolado do I/O: dado o que o Mercado Pago
 * devolveu e o que já existe no banco, o que FALTA, o que DIVERGE e o que já
 * está conferido. É a parte que decide se o operador vai ver um diff honesto
 * ou um número inventado — e a única que dá para provar sem Postgres e sem o
 * SDK do MP.
 */

function candidato(over: Partial<CandidatoMp> = {}): CandidatoMp {
  return {
    mpPaymentId: "1",
    tenantId: 7,
    tenantName: "Auto Brasil",
    tenantDocument: "123",
    plan: "pro",
    mpPreapprovalId: "preap-7",
    couponId: null,
    paidAt: "2026-08-15T12:00:00.000Z",
    grossCents: 24990,
    status: "approved",
    ...over,
  };
}

describe("dentroDaCompetencia — o mesmo recorte semiaberto de listPaymentsByPeriod", () => {
  const from = "2026-08-01T00:00:00.000Z";
  const to = "2026-09-01T00:00:00.000Z";

  it("aceita o primeiro instante do mês", () => {
    expect(dentroDaCompetencia("2026-08-01T00:00:00.000Z", from, to)).toBe(true);
  });

  it("aceita o último instante do mês", () => {
    expect(dentroDaCompetencia("2026-08-31T23:59:59.999Z", from, to)).toBe(true);
  });

  /**
   * O limite de cima é EXCLUSIVO — igual ao `lt` de `listPaymentsByPeriod`
   * (lib/db/payments.ts). Se aqui fosse inclusivo, o pagamento da virada
   * apareceria como "faltando" em agosto (porque o `lt` do banco o deixou
   * fora da lista local de agosto) e a reconciliação mostraria uma diferença
   * que não existe.
   */
  it("rejeita o primeiro instante do mês SEGUINTE", () => {
    expect(dentroDaCompetencia("2026-09-01T00:00:00.000Z", from, to)).toBe(false);
  });

  it("rejeita o último instante do mês ANTERIOR", () => {
    expect(dentroDaCompetencia("2026-07-31T23:59:59.999Z", from, to)).toBe(false);
  });

  /**
   * Comparação é TEMPORAL, não lexicográfica: o MP devolve data com offset
   * (`-03:00`), e `"2026-08-31T22:00:00.000-03:00"` (que é 01/09 01:00 UTC)
   * ordena ANTES de `"2026-09-01T00:00:00.000Z"` como string, mas é DEPOIS
   * dele no tempo. Um `>=`/`<` direto entre strings colocaria esse pagamento
   * em agosto.
   */
  it("compara instantes, não strings — offset -03:00 na virada cai no mês certo", () => {
    // 31/08 22:00 em São Paulo = 01/09 01:00 UTC → é setembro.
    expect(dentroDaCompetencia("2026-08-31T22:00:00.000-03:00", from, to)).toBe(false);
    // 31/07 22:00 em São Paulo = 01/08 01:00 UTC → é agosto.
    expect(dentroDaCompetencia("2026-07-31T22:00:00.000-03:00", from, to)).toBe(true);
  });

  it("data ilegível fica de fora em vez de virar NaN silencioso", () => {
    expect(dentroDaCompetencia("nem data é", from, to)).toBe(false);
  });
});

describe("classificarDiferenca", () => {
  it("pagamento que só existe no MP entra como faltante", () => {
    const d = classificarDiferenca([candidato({ mpPaymentId: "999" })], []);
    expect(d.faltantes).toHaveLength(1);
    expect(d.faltantes[0].mpPaymentId).toBe("999");
    expect(d.jaRegistrados).toBe(0);
  });

  /** É o caso do brief: pagamento que já existe localmente NÃO é diferença. */
  it("pagamento que já existe localmente não aparece como diferença", () => {
    const d = classificarDiferenca(
      [candidato({ mpPaymentId: "999", status: "approved" })],
      [{ mp_payment_id: "999", status: "approved" }],
    );
    expect(d.faltantes).toEqual([]);
    expect(d.divergentes).toEqual([]);
    expect(d.jaRegistrados).toBe(1);
    expect(d.totalFaltanteCents).toBe(0);
  });

  it("soma o bruto só dos faltantes", () => {
    const d = classificarDiferenca(
      [
        candidato({ mpPaymentId: "1", grossCents: 24990 }),
        candidato({ mpPaymentId: "2", grossCents: 9900 }),
        candidato({ mpPaymentId: "3", grossCents: 100_000 }),
      ],
      [{ mp_payment_id: "3", status: "approved" }],
    );
    expect(d.faltantes.map((f) => f.mpPaymentId)).toEqual(["1", "2"]);
    expect(d.totalFaltanteCents).toBe(34890);
  });

  it("status diferente do gravado entra como divergente, não como faltante", () => {
    const d = classificarDiferenca(
      [candidato({ mpPaymentId: "999", status: "refunded" })],
      [{ mp_payment_id: "999", status: "approved" }],
    );
    expect(d.faltantes).toEqual([]);
    expect(d.divergentes).toHaveLength(1);
    expect(d.divergentes[0]).toMatchObject({
      mpPaymentId: "999",
      statusLocal: "approved",
      status: "refunded",
    });
  });

  /**
   * A reconciliação lê o MP num instante qualquer e pode pegar um `approved`
   * que já foi estornado depois (ou antes de o MP propagar o estorno). Sem
   * `shouldOverwriteStatus`, ela "consertaria" um `refunded` de volta pra
   * `approved` e a receita voltaria a ser contada sobre um pagamento
   * devolvido — o mesmo bug que o webhook já trava.
   */
  it("NÃO oferece reverter um refunded gravado para um approved do MP", () => {
    const d = classificarDiferenca(
      [candidato({ mpPaymentId: "999", status: "approved" })],
      [{ mp_payment_id: "999", status: "refunded" }],
    );
    expect(d.divergentes).toEqual([]);
    expect(d.faltantes).toEqual([]);
    expect(d.jaRegistrados).toBe(1);
  });

  it("chargeback local também não volta para approved", () => {
    const d = classificarDiferenca(
      [candidato({ mpPaymentId: "999", status: "approved" })],
      [{ mp_payment_id: "999", status: "chargeback" }],
    );
    expect(d.divergentes).toEqual([]);
  });

  it("refunded local pode virar chargeback (os dois são terminais negativos)", () => {
    const d = classificarDiferenca(
      [candidato({ mpPaymentId: "999", status: "chargeback" })],
      [{ mp_payment_id: "999", status: "refunded" }],
    );
    expect(d.divergentes).toHaveLength(1);
  });

  it("preserva os dados que a UI mostra: tenant, bruto e data", () => {
    const d = classificarDiferenca(
      [candidato({ mpPaymentId: "5", tenantName: "Loja do Zé", grossCents: 9900 })],
      [],
    );
    expect(d.faltantes[0]).toMatchObject({
      tenantName: "Loja do Zé",
      grossCents: 9900,
      paidAt: "2026-08-15T12:00:00.000Z",
    });
  });

  it("MP vazio com linhas locais não inventa diferença", () => {
    const d = classificarDiferenca([], [{ mp_payment_id: "999", status: "approved" }]);
    expect(d.faltantes).toEqual([]);
    expect(d.divergentes).toEqual([]);
    expect(d.jaRegistrados).toBe(0);
  });
});
