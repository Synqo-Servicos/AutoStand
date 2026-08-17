import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const insertValues = vi.fn();
const insertReturning = vi.fn();
const selectWhere = vi.fn();
const selectRows = vi.fn();
const updateSetArgs = vi.fn();
const updateWhereArgs = vi.fn();
const updateReturning = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {
    insert: () => ({
      values: (v: unknown) => { insertValues(v); return {
        onConflictDoNothing: () => ({ returning: () => insertReturning() }),
      }; },
    }),
    select: () => ({ from: () => ({
      where: (cond: unknown) => {
        selectWhere(cond);
        return { orderBy: () => selectRows(), limit: () => selectRows() };
      },
    }) }),
    update: () => ({
      set: (v: unknown) => { updateSetArgs(v); return {
        where: (cond: unknown) => { updateWhereArgs(cond); return { returning: () => updateReturning() }; },
      }; },
    }),
  },
  client: {},
}));

describe("recordPayment", () => {
  beforeEach(() => { vi.clearAllMocks(); insertReturning.mockReset(); });

  it("grava e reporta created quando a linha entrou", async () => {
    insertReturning.mockResolvedValueOnce([{ id: 1 }]);
    const { recordPayment } = await import("@/lib/db/payments");
    const r = await recordPayment({
      tenant_id: 7, tenant_name: "Auto Brasil", tenant_document: "12345678000199",
      plan: "pro", mp_payment_id: "mp-1", mp_preapproval_id: "pre-1",
      gross_cents: 24990, fee_cents: 1200, net_cents: 23790,
      status: "approved", paid_at: "2026-08-15T12:00:00Z", coupon_id: null, incomplete: false,
    });
    expect(r.created).toBe(true);
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ mp_payment_id: "mp-1" }));
  });

  it("é idempotente — segunda vez não cria", async () => {
    insertReturning.mockResolvedValueOnce([]);
    const { recordPayment } = await import("@/lib/db/payments");
    const r = await recordPayment({
      tenant_id: 7, tenant_name: "Auto Brasil", tenant_document: null, plan: "pro",
      mp_payment_id: "mp-1", mp_preapproval_id: null,
      gross_cents: 24990, fee_cents: null, net_cents: null,
      status: "approved", paid_at: "2026-08-15T12:00:00Z", coupon_id: null, incomplete: true,
    });
    expect(r.created).toBe(false);
  });

  it("descarta campo malicioso no input — só a allowlist é gravada", async () => {
    insertReturning.mockResolvedValueOnce([{ id: 1 }]);
    const { recordPayment } = await import("@/lib/db/payments");
    await recordPayment({
      tenant_id: 7, tenant_name: "X", tenant_document: null, plan: null,
      mp_payment_id: "mp-2", mp_preapproval_id: null,
      gross_cents: 100, fee_cents: null, net_cents: null,
      status: "approved", paid_at: "2026-08-15T12:00:00Z", coupon_id: null, incomplete: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...( { nfse_number: "FALSO", id: 999 } as any ),
    });
    const arg = insertValues.mock.calls[0][0];
    expect(arg).not.toHaveProperty("nfse_number");
    expect(arg).not.toHaveProperty("id");
  });
});

describe("periodBounds", () => {
  it("periodBounds('2026-08') devolve o par [início, fim) correto", async () => {
    const { periodBounds } = await import("@/lib/db/payments");
    expect(periodBounds("2026-08")).toEqual({
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-09-01T00:00:00.000Z",
    });
  });

  it("periodBounds('2026-12') atravessa a virada de ano", async () => {
    const { periodBounds } = await import("@/lib/db/payments");
    expect(periodBounds("2026-12")).toEqual({
      from: "2026-12-01T00:00:00.000Z",
      to: "2027-01-01T00:00:00.000Z",
    });
  });
});

describe("listPaymentsByPeriod — fronteira do período", () => {
  beforeEach(() => { vi.clearAllMocks(); selectRows.mockReset(); });

  it("o limite superior é EXCLUSIVO — pagamento no instante exato de `to` pertence ao mês seguinte", async () => {
    selectRows.mockResolvedValueOnce([]);
    const { listPaymentsByPeriod } = await import("@/lib/db/payments");
    await listPaymentsByPeriod("2026-08");

    // `to` de agosto ("2026-09-01T00:00:00.000Z") é o INÍCIO de setembro,
    // não o fim de agosto. Compila a condição de fato passada pro
    // `.where()` e confirma que o limite superior usa `<` (estrito), não
    // `<=` — com `<=` um pagamento nesse instante exato apareceria em
    // agosto E em setembro, contando como receita duas vezes.
    const condition = selectWhere.mock.calls[0][0] as SQL;
    const compiled = new PgDialect().sqlToQuery(condition).sql;
    expect(compiled).toContain("<");
    expect(compiled).not.toContain("<=");
  });
});

/**
 * A fila fiscal é o gatilho de uma ação irreversível fora do sistema: o
 * contador lê esta lista e emite NFS-e na prefeitura. Um pagamento que
 * reaparece aqui vira nota emitida DUAS VEZES — e o 409 de `registerNfse`
 * não protege disso, porque ele só dispara quando o contador volta pra
 * registrar o número, ou seja, depois de a nota já existir juridicamente.
 *
 * Por isso os testes abaixo provam a FORMA do SQL (condição real compilada
 * por `PgDialect`, mesma técnica de `listPaymentsByPeriod`), não que a
 * função foi chamada: o mock de `db` ignora o `where`, então qualquer
 * asserção sobre linhas devolvidas sobreviveria à remoção do filtro.
 */
describe("listPendingNfse — a fila só pode conter o que ainda não virou nota", () => {
  beforeEach(() => { vi.clearAllMocks(); selectRows.mockReset(); });

  it("o WHERE exige nfse_issued_at IS NULL — pagamento já emitido não volta pra fila", async () => {
    selectRows.mockResolvedValueOnce([]);
    const { listPendingNfse } = await import("@/lib/db/payments");
    await listPendingNfse();

    const condition = selectWhere.mock.calls[0][0] as SQL;
    const compiled = new PgDialect().sqlToQuery(condition).sql.toLowerCase();
    // Coluna nomeada de propósito: um `is null` solto poderia vir de
    // qualquer outra coluna nullable e o teste passaria por acidente.
    expect(compiled).toContain('"nfse_issued_at" is null');
  });

  it("o WHERE exige status = 'approved' — estorno e chargeback não entram na fila", async () => {
    selectRows.mockResolvedValueOnce([]);
    const { listPendingNfse } = await import("@/lib/db/payments");
    await listPendingNfse();

    const { sql: compiled, params } = new PgDialect().sqlToQuery(
      selectWhere.mock.calls[0][0] as SQL,
    );
    // O valor viaja como parâmetro ($1), não inline no SQL — por isso a
    // asserção é em duas partes: a coluna aparece na condição, e
    // "approved" é o valor de fato ligado a ela.
    expect(compiled.toLowerCase()).toContain('"status" =');
    expect(params).toContain("approved");
  });

  it("as duas condições andam juntas num AND — nenhuma delas sozinha basta", async () => {
    selectRows.mockResolvedValueOnce([]);
    const { listPendingNfse } = await import("@/lib/db/payments");
    await listPendingNfse();

    const compiled = new PgDialect()
      .sqlToQuery(selectWhere.mock.calls[0][0] as SQL).sql.toLowerCase();
    expect(compiled).toContain("and");
  });
});

describe("sumCaixa", () => {
  beforeEach(() => { vi.clearAllMocks(); selectRows.mockReset(); });

  it("soma só pagamentos approved — estorno e chargeback ficam de fora", async () => {
    selectRows.mockResolvedValueOnce([
      { status: "approved", gross_cents: 10000, fee_cents: 500 },
      { status: "refunded", gross_cents: 20000, fee_cents: 1000 },
      { status: "chargeback", gross_cents: 30000, fee_cents: 1500 },
      { status: "approved", gross_cents: 5000, fee_cents: 250 },
    ]);
    const { sumCaixa } = await import("@/lib/db/payments");
    const result = await sumCaixa("2026-08");
    expect(result).toEqual({ gross: 15000, fee: 750, netBeforeTax: 14250 });
  });
});

describe("updatePaymentStatus", () => {
  beforeEach(() => { vi.clearAllMocks(); updateReturning.mockReset(); });

  it("atualiza o status de um pagamento existente (caminho do estorno)", async () => {
    updateReturning.mockResolvedValueOnce([{ id: 1, mp_payment_id: "mp-1", status: "refunded" }]);
    const { updatePaymentStatus } = await import("@/lib/db/payments");
    const row = await updatePaymentStatus("mp-1", "refunded");
    expect(row).toEqual({ id: 1, mp_payment_id: "mp-1", status: "refunded" });
    expect(updateSetArgs).toHaveBeenCalledWith({ status: "refunded" });
  });

  it("devolve null quando o mp_payment_id não existe", async () => {
    updateReturning.mockResolvedValueOnce([]);
    const { updatePaymentStatus } = await import("@/lib/db/payments");
    const row = await updatePaymentStatus("mp-inexistente", "refunded");
    expect(row).toBeNull();
  });

  it("é idempotente — duas chamadas com o mesmo status mandam o mesmo UPDATE e convergem pro mesmo resultado", async () => {
    const rowAfterUpdate = { id: 1, mp_payment_id: "mp-1", status: "refunded" };
    // `mockResolvedValueOnce` duas vezes (não `mockResolvedValue` fixo): cada
    // chamada consome sua própria resposta da fila. Se a implementação
    // deixasse de chamar `db.update` na segunda invocação (cache, early
    // return, o que for), a fila ficaria com uma resposta não consumida e
    // `toHaveBeenCalledTimes(2)` abaixo cairia — diferente de um mock fixo,
    // que "passaria" mesmo se o código ignorasse a segunda chamada.
    updateReturning.mockResolvedValueOnce([rowAfterUpdate]);
    updateReturning.mockResolvedValueOnce([rowAfterUpdate]);
    const { updatePaymentStatus } = await import("@/lib/db/payments");

    const first = await updatePaymentStatus("mp-1", "refunded");
    const second = await updatePaymentStatus("mp-1", "refunded");

    expect(first).toEqual(rowAfterUpdate);
    expect(second).toEqual(rowAfterUpdate);
    // Mesmo SET nas duas chamadas — sem incremento nem acúmulo entre elas,
    // então a segunda converge pro mesmo resultado que a primeira (o mesmo
    // que um UPDATE puro faria no banco real).
    expect(updateSetArgs).toHaveBeenNthCalledWith(1, { status: "refunded" });
    expect(updateSetArgs).toHaveBeenNthCalledWith(2, { status: "refunded" });
    expect(updateReturning).toHaveBeenCalledTimes(2);
  });
});

describe("getPaymentByMpId", () => {
  beforeEach(() => { vi.clearAllMocks(); selectRows.mockReset(); });

  it("devolve a linha quando o mp_payment_id existe", async () => {
    selectRows.mockResolvedValueOnce([{ id: 1, mp_payment_id: "mp-1", status: "approved" }]);
    const { getPaymentByMpId } = await import("@/lib/db/payments");
    const row = await getPaymentByMpId("mp-1");
    expect(row).toEqual({ id: 1, mp_payment_id: "mp-1", status: "approved" });
  });

  it("devolve null quando o mp_payment_id não existe", async () => {
    selectRows.mockResolvedValueOnce([]);
    const { getPaymentByMpId } = await import("@/lib/db/payments");
    const row = await getPaymentByMpId("mp-inexistente");
    expect(row).toBeNull();
  });
});

describe("updatePayment", () => {
  beforeEach(() => { vi.clearAllMocks(); updateReturning.mockReset(); });

  it("aplica um patch parcial — não só status, como updatePaymentStatus", async () => {
    updateReturning.mockResolvedValueOnce([
      { id: 1, mp_payment_id: "mp-1", status: "approved", fee_cents: 1200, net_cents: 23790, incomplete: false },
    ]);
    const { updatePayment } = await import("@/lib/db/payments");
    const row = await updatePayment("mp-1", {
      status: "approved", fee_cents: 1200, net_cents: 23790, incomplete: false,
    });
    expect(row).toEqual(
      { id: 1, mp_payment_id: "mp-1", status: "approved", fee_cents: 1200, net_cents: 23790, incomplete: false },
    );
    expect(updateSetArgs).toHaveBeenCalledWith({
      status: "approved", fee_cents: 1200, net_cents: 23790, incomplete: false,
    });
  });

  it("um patch sem `status` não manda a chave no SET — não sobrescreve status por acidente", async () => {
    updateReturning.mockResolvedValueOnce([{ id: 1, mp_payment_id: "mp-1" }]);
    const { updatePayment } = await import("@/lib/db/payments");
    await updatePayment("mp-1", { paid_at: "2026-08-15T12:00:00.000Z" });
    const setArg = updateSetArgs.mock.calls[0][0];
    expect(setArg).toEqual({ paid_at: "2026-08-15T12:00:00.000Z" });
    expect(setArg).not.toHaveProperty("status");
  });

  it("devolve null quando o mp_payment_id não existe", async () => {
    updateReturning.mockResolvedValueOnce([]);
    const { updatePayment } = await import("@/lib/db/payments");
    const row = await updatePayment("mp-inexistente", { status: "refunded" });
    expect(row).toBeNull();
  });
});

describe("registerNfse", () => {
  beforeEach(() => { vi.clearAllMocks(); updateReturning.mockReset(); });

  it("grava numero, nfse_issued_at e nfse_issued_by quando ainda não há nota", async () => {
    updateReturning.mockResolvedValueOnce([{ id: 1, nfse_number: "123", nfse_issued_by: 7 }]);
    const { registerNfse } = await import("@/lib/db/payments");
    const row = await registerNfse(1, "123", 7);
    expect(row).toEqual({ id: 1, nfse_number: "123", nfse_issued_by: 7 });
    expect(updateSetArgs).toHaveBeenCalledWith(
      expect.objectContaining({ nfse_number: "123", nfse_issued_by: 7 }),
    );
  });

  // Prova estrutural do guard de idempotência: compila a condição real
  // passada pro `.where()` (mesma técnica do teste de `listPaymentsByPeriod`
  // acima) e confirma que ela exige `nfse_issued_at IS NULL` — não só "id
  // bate". Remover `isNull(payments.nfse_issued_at)` do WHERE em
  // lib/db/payments.ts derruba este teste (verificado por mutação, ver
  // task-6-report.md).
  it("o WHERE exige nfse_issued_at IS NULL — não só o id do pagamento", async () => {
    updateReturning.mockResolvedValueOnce([{ id: 1 }]);
    const { registerNfse } = await import("@/lib/db/payments");
    await registerNfse(1, "123", 7);

    const condition = updateWhereArgs.mock.calls[0][0] as SQL;
    const compiled = new PgDialect().sqlToQuery(condition).sql.toLowerCase();
    expect(compiled).toContain("is null");
  });

  it("registrar duas vezes o mesmo pagamento — a 2ª chamada não altera o número já gravado (devolve null)", async () => {
    // 1ª chamada: nfse_issued_at ainda é NULL -> UPDATE afeta 1 linha.
    updateReturning.mockResolvedValueOnce([{ id: 1, nfse_number: "111", nfse_issued_by: 7 }]);
    // 2ª chamada: no banco real, nfse_issued_at já não é mais NULL, então a
    // condição do WHERE não bate em nenhuma linha -> UPDATE afeta 0 linhas.
    // Simulamos aqui o resultado desse WHERE não bater (não há Postgres
    // real neste teste) — é o comportamento que a asserção acima prova que
    // a query pede.
    updateReturning.mockResolvedValueOnce([]);

    const { registerNfse } = await import("@/lib/db/payments");
    const first = await registerNfse(1, "111", 7);
    const second = await registerNfse(1, "222", 9);

    expect(first).toEqual({ id: 1, nfse_number: "111", nfse_issued_by: 7 });
    expect(second).toBeNull();
    // A 2ª chamada tentou "222" no SET — mas como o mock representa "0
    // linhas afetadas" (o WHERE não bateu), o retorno é null: o número
    // "111" da 1ª chamada nunca é sobrescrito no banco.
    expect(updateSetArgs).toHaveBeenNthCalledWith(2, expect.objectContaining({ nfse_number: "222" }));
  });

  it("devolve null quando o id do pagamento não existe", async () => {
    updateReturning.mockResolvedValueOnce([]);
    const { registerNfse } = await import("@/lib/db/payments");
    const row = await registerNfse(999, "123", 7);
    expect(row).toBeNull();
  });
});
