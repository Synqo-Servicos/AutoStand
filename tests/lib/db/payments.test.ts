import { describe, it, expect, vi, beforeEach } from "vitest";

const insertValues = vi.fn();
const insertReturning = vi.fn();
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
    select: () => ({ from: () => ({ where: () => ({ orderBy: () => selectRows() }) }) }),
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

  it("é idempotente — aplicar duas vezes dá o mesmo resultado", async () => {
    updateReturning.mockResolvedValue([{ id: 1, mp_payment_id: "mp-1", status: "refunded" }]);
    const { updatePaymentStatus } = await import("@/lib/db/payments");
    const first = await updatePaymentStatus("mp-1", "refunded");
    const second = await updatePaymentStatus("mp-1", "refunded");
    expect(first).toEqual(second);
    expect(updateReturning).toHaveBeenCalledTimes(2);
  });
});
