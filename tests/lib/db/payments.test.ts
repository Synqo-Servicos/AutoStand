import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const insertValues = vi.fn();
const insertReturning = vi.fn();
const selectWhere = vi.fn();
const selectRows = vi.fn();
const updateSetArgs = vi.fn();
const updateReturning = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {
    insert: () => ({
      values: (v: unknown) => { insertValues(v); return {
        onConflictDoNothing: () => ({ returning: () => insertReturning() }),
      }; },
    }),
    select: () => ({ from: () => ({
      where: (cond: unknown) => { selectWhere(cond); return { orderBy: () => selectRows() }; },
    }) }),
    update: () => ({
      set: (v: unknown) => { updateSetArgs(v); return {
        where: () => ({ returning: () => updateReturning() }),
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
