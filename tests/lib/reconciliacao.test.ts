import { describe, it, expect } from "vitest";
import {
  classificarDiferenca,
  dentroDaCompetencia,
  type CandidatoMp,
} from "@/lib/reconciliacao";
import { competenciaDeInstante, periodoDaCompetencia } from "@/lib/competencia";

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

/**
 * ============================================================================
 * A COMPETÊNCIA É DECIDIDA PELO INSTANTE, CONVERTIDO PARA SÃO PAULO
 * ============================================================================
 *
 * **Estes testes afirmavam o oposto até a correção da causa-raiz.** Vale
 * registrar por quê, porque a inversão foi deliberada e não um afrouxamento:
 *
 * `payments.paid_at` era `timestamp` **sem** time zone. O Postgres descartava
 * o offset ao gravar (`'2026-08-31T22:00:00.000-03:00'` virava
 * `2026-08-31 22:00:00`), então este filtro ignorava o offset TAMBÉM — de
 * propósito, para não criar uma segunda opinião sobre em que mês a linha
 * está. O invariante protegido não era "é São Paulo", era "os dois lados
 * concordam".
 *
 * O preço daquele acordo era um risco que não sinalizava: se o MP mandasse
 * `Z` em vez de `-03:00`, o relógio de parede deslizava 3 h e ninguém via —
 * justamente porque os dois lados erravam igual.
 *
 * A causa-raiz foi consertada: `paid_at` é `timestamptz` e guarda o INSTANTE,
 * `periodBounds` devolve instantes ancorados na meia-noite de São Paulo, e a
 * competência sai de `competenciaDeInstante`. Com o banco guardando instante,
 * é o recorte por relógio de parede que passaria a divergir. Os dois lados
 * continuam concordando — agora concordando no certo.
 *
 * O modo de falha que o recorte previne segue o mesmo: um pagamento do lado
 * errado da fronteira sumiria de TODAS as categorias e a tela diria "Tudo
 * conferido" com o mês faturando a menos.
 */
describe("dentroDaCompetencia — recorte por INSTANTE, alinhado ao banco", () => {
  // Os limites reais de agosto/2026: meia-noite de São Paulo, que é 03:00Z.
  const from = "2026-08-01T03:00:00.000Z";
  const to = "2026-09-01T03:00:00.000Z";

  it("os limites usados aqui são exatamente os que o banco recebe", () => {
    // Se `periodBounds` mudar, este teste denuncia antes dos outros mentirem.
    expect(periodoDaCompetencia("2026-08")).toMatchObject({ from, to });
  });

  it("aceita o primeiro instante do mês em São Paulo", () => {
    expect(dentroDaCompetencia("2026-08-01T00:00:00.000-03:00", from, to)).toBe(true);
  });

  it("aceita o último instante do mês em São Paulo", () => {
    expect(dentroDaCompetencia("2026-08-31T23:59:59.999-03:00", from, to)).toBe(true);
  });

  /**
   * A borda que motivou tudo: 22:00 de 31/08 em São Paulo é 01/09 01:00 UTC.
   * Continua sendo AGOSTO — mas agora porque o instante cai dentro da janela
   * de São Paulo, não porque o offset foi jogado fora.
   */
  it("21:00–23:59 do último dia continua sendo DESTE mês", () => {
    expect(dentroDaCompetencia("2026-08-31T21:00:00.000-03:00", from, to)).toBe(true);
    expect(dentroDaCompetencia("2026-08-31T22:00:00.000-03:00", from, to)).toBe(true);
    expect(dentroDaCompetencia("2026-08-31T23:59:00.000-03:00", from, to)).toBe(true);
  });

  /** Limite de cima EXCLUSIVO — igual ao `lt` de `listPaymentsByPeriod`. */
  it("rejeita o primeiro instante do mês SEGUINTE", () => {
    expect(dentroDaCompetencia("2026-09-01T00:00:00.000-03:00", from, to)).toBe(false);
  });

  it("rejeita o último instante do mês ANTERIOR", () => {
    expect(dentroDaCompetencia("2026-07-31T23:59:59.999-03:00", from, to)).toBe(false);
    expect(dentroDaCompetencia("2026-07-31T22:00:00.000-03:00", from, to)).toBe(false);
  });

  /**
   * A INVERSÃO. Antes: "mesmo relógio de parede, offsets diferentes → mesma
   * competência". Agora: o offset é HONRADO, então grafias diferentes do mesmo
   * INSTANTE dão a mesma competência, e relógios de parede iguais em fusos
   * diferentes NÃO dão.
   *
   * É exatamente isto que fecha o risco residual do desenho anterior: o MP
   * mandando `Z` não desloca mais nada.
   */
  it("honra o offset — o que decide é o instante, não os dígitos", () => {
    // Quatro grafias do MESMO instante (2026-08-31T22:00 em São Paulo):
    // todas são agosto.
    for (const grafia of [
      "2026-08-31T22:00:00.000-03:00",
      "2026-09-01T01:00:00.000Z",
      "2026-09-01 01:00:00+00",
      "2026-09-01T06:00:00.000+05:00",
    ]) {
      expect(dentroDaCompetencia(grafia, from, to), grafia).toBe(true);
    }

    // Mesmo relógio de parede, offset diferente = OUTRO instante. `12:00Z` é
    // 09:00 em São Paulo do mesmo dia (agosto), mas `12:00+05:00` é 04:00 e
    // `2026-09-01T00:30:00-03:00` já é setembro em São Paulo.
    expect(dentroDaCompetencia("2026-08-15T12:00:00.000-03:00", from, to)).toBe(true);
    expect(dentroDaCompetencia("2026-08-15T12:00:00.000Z", from, to)).toBe(true);
    expect(dentroDaCompetencia("2026-09-01T00:30:00.000-03:00", from, to)).toBe(false);
    // 01/09 00:30Z ainda é 31/08 21:30 em São Paulo → agosto.
    expect(dentroDaCompetencia("2026-09-01T00:30:00.000Z", from, to)).toBe(true);
  });

  /**
   * O outro lado da mesma moeda: o filtro e o classificador de competência não
   * podem discordar, senão a reconciliação e a fila fiscal contam meses
   * diferentes para o mesmo pagamento.
   */
  it("concorda com competenciaDeInstante em toda a faixa testada", () => {
    for (const carimbo of [
      "2026-08-01T00:00:00.000-03:00",
      "2026-08-15T12:00:00.000-03:00",
      "2026-08-31T22:00:00.000-03:00",
      "2026-09-01T00:30:00.000Z",
      "2026-09-01T00:00:00.000-03:00",
      "2026-07-31T23:59:59.999-03:00",
    ]) {
      expect(dentroDaCompetencia(carimbo, from, to), carimbo)
        .toBe(competenciaDeInstante(carimbo) === "2026-08");
    }
  });

  it("aceita o formato sem milissegundos que o MP às vezes devolve", () => {
    expect(dentroDaCompetencia("2026-08-15T12:00:00-03:00", from, to)).toBe(true);
  });

  it("data ilegível fica de fora em vez de virar NaN silencioso", () => {
    expect(dentroDaCompetencia("nem data é", from, to)).toBe(false);
    expect(dentroDaCompetencia("2026-13-01T00:00:00.000-03:00", from, to)).toBe(false);
    expect(dentroDaCompetencia("2026-08-15T99:00:00.000-03:00", from, to)).toBe(false);
  });

  /**
   * Carimbo SEM offset não designa instante — não dá para dizer se é agosto ou
   * setembro. Sai como `false` aqui, e a rota o manda para `ignorados` em vez
   * de descartá-lo em silêncio (que seria o "Tudo conferido" mentiroso).
   */
  it("carimbo sem offset é ilegível, não 'fora da competência'", () => {
    expect(dentroDaCompetencia("2026-08-15 12:00:00", from, to)).toBe(false);
    expect(dentroDaCompetencia("2026-08-15T12:00:00.000", from, to)).toBe(false);
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
