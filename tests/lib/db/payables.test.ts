import { describe, it, expect, vi, beforeEach } from "vitest";

const selectRows = vi.fn();
const selectLimitRows = vi.fn();
const insertValues = vi.fn();
const insertReturning = vi.fn();
const updateSet = vi.fn();
const updateWhere = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => selectRows(),
          limit: () => selectLimitRows(),
        }),
      }),
    }),
    insert: () => ({
      values: (v: unknown) => {
        insertValues(v);
        return { returning: () => insertReturning() };
      },
    }),
    update: () => ({
      set: (v: unknown) => {
        updateSet(v);
        return { where: () => updateWhere() };
      },
    }),
  },
  client: {},
}));

describe("listBills", () => {
  beforeEach(() => vi.clearAllMocks());

  it("junta regra e transação numa conta classificada", async () => {
    // 1ª chamada: regras. 2ª: transações casadas.
    selectRows
      .mockResolvedValueOnce([{
        id: 1, tenant_id: 7, type: "despesa_fixa", category: "Aluguel",
        description: "Galpão", supplier: "Imobiliária Costa", amount_cents: 450_000,
        frequency: "mensal", first_due_date: "2026-06-10", installments: null,
        payment_method: "boleto", active: true, notes: null, created_at: "2026-06-01T00:00:00Z",
      }])
      .mockResolvedValueOnce([
        { payable_id: 1, due_date: "2026-08-10", transaction_id: 99, amount: 462_000 },
      ]);

    const { listBills } = await import("@/lib/db/payables");
    const bills = await listBills(7, "2026-08-13");

    const ago = bills.find((b) => b.due_date === "2026-08-10")!;
    expect(ago.status).toBe("pago");
    expect(ago.paid_amount_cents).toBe(462_000);
    expect(ago.category).toBe("Aluguel");
    expect(ago.supplier).toBe("Imobiliária Costa");

    const jul = bills.find((b) => b.due_date === "2026-07-10")!;
    expect(jul.status).toBe("atrasado");
  });

  it("devolve vazio quando o tenant não tem regra", async () => {
    selectRows.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const { listBills } = await import("@/lib/db/payables");
    expect(await listBills(7, "2026-08-13")).toEqual([]);
  });
});

describe("hasPaymentFor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna true quando já existe transação para (regra, vencimento) — trava de duplicata", async () => {
    selectLimitRows.mockResolvedValueOnce([{ id: 99 }]);
    const { hasPaymentFor } = await import("@/lib/db/payables");
    expect(await hasPaymentFor(7, 1, "2026-08-10")).toBe(true);
  });

  it("retorna false quando não há transação casada", async () => {
    selectLimitRows.mockResolvedValueOnce([]);
    const { hasPaymentFor } = await import("@/lib/db/payables");
    expect(await hasPaymentFor(7, 1, "2026-08-10")).toBe(false);
  });
});

describe("updatePayable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("com { active: false } encerra a conta — único mecanismo de 'não deletável'", async () => {
    selectLimitRows.mockResolvedValueOnce([{
      id: 1, tenant_id: 7, type: "despesa_fixa", category: "Aluguel",
      description: "Galpão", supplier: "Imobiliária Costa", amount_cents: 450_000,
      frequency: "mensal", first_due_date: "2026-06-10", installments: null,
      payment_method: "boleto", active: false, notes: null, created_at: "2026-06-01T00:00:00Z",
    }]);

    const { updatePayable } = await import("@/lib/db/payables");
    const row = await updatePayable(7, 1, { active: false });

    expect(updateSet).toHaveBeenCalledWith({ active: false });
    expect(row?.active).toBe(false);
  });

  it("descarta um tenant_id malicioso no input — nunca chega ao .set()", async () => {
    selectLimitRows.mockResolvedValueOnce([{
      id: 1, tenant_id: 7, type: "despesa_fixa", category: "Aluguel",
      description: "Galpão", supplier: "Imobiliária Costa", amount_cents: 450_000,
      frequency: "mensal", first_due_date: "2026-06-10", installments: null,
      payment_method: "boleto", active: true, notes: null, created_at: "2026-06-01T00:00:00Z",
    }]);

    const { updatePayable } = await import("@/lib/db/payables");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updatePayable(7, 1, { supplier: "Novo Fornecedor", tenant_id: 999 } as any);

    expect(updateSet).toHaveBeenCalledWith({ supplier: "Novo Fornecedor" });
    const setArg = updateSet.mock.calls[0][0];
    expect(setArg).not.toHaveProperty("tenant_id");
  });
});

describe("createPayable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("descarta um tenant_id malicioso no input — sempre usa o tenantId do argumento", async () => {
    insertReturning.mockResolvedValueOnce([{
      id: 5, tenant_id: 7, type: "despesa_fixa", category: "Aluguel",
      description: "Galpão", supplier: "Imobiliária Costa", amount_cents: 450_000,
      frequency: "mensal", first_due_date: "2026-06-10", installments: null,
      payment_method: "boleto", active: true, notes: null, created_at: "2026-06-01T00:00:00Z",
    }]);

    const { createPayable } = await import("@/lib/db/payables");
    const input = {
      type: "despesa_fixa", category: "Aluguel", description: "Galpão",
      supplier: "Imobiliária Costa", amount_cents: 450_000, frequency: "mensal",
      first_due_date: "2026-06-10", installments: null, payment_method: "boleto",
      notes: null,
      tenant_id: 999, // tentativa de mass-assignment
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await createPayable(7, input as any);

    const valuesArg = insertValues.mock.calls[0][0];
    expect(valuesArg.tenant_id).toBe(7);
    expect(row.tenant_id).toBe(7);
  });
});

describe("addPayableAttachment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("descarta tenant_id/payable_id maliciosos no input — sempre usa os argumentos", async () => {
    insertReturning.mockResolvedValueOnce([{
      id: 10, tenant_id: 7, payable_id: 1, name: "boleto.pdf",
      url: "https://cdn.autostand.com.br/tenants/7/payables/1-a.pdf",
      size: 1024, mime_type: "application/pdf", transaction_id: null,
      uploaded_by: null, created_at: "2026-08-13T00:00:00Z",
    }]);

    const { addPayableAttachment } = await import("@/lib/db/payables");
    const input = {
      name: "boleto.pdf",
      url: "https://cdn.autostand.com.br/tenants/7/payables/1-a.pdf",
      size: 1024, mime_type: "application/pdf",
      transaction_id: null, uploaded_by: null,
      tenant_id: 999, payable_id: 888, // tentativa de mass-assignment
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await addPayableAttachment(7, 1, input as any);

    const valuesArg = insertValues.mock.calls[0][0];
    expect(valuesArg.tenant_id).toBe(7);
    expect(valuesArg.payable_id).toBe(1);
    expect(row.tenant_id).toBe(7);
    expect(row.payable_id).toBe(1);
  });
});
