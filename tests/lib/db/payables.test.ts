import { describe, it, expect, vi, beforeEach } from "vitest";

const selectRows = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ orderBy: () => selectRows() }) }) }),
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
