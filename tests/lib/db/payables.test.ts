import { describe, it, expect, vi, beforeEach } from "vitest";
import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import { payables, transactions } from "@/lib/schema";

const selectRows = vi.fn();
const selectLimitRows = vi.fn();
const insertValues = vi.fn();
const insertReturning = vi.fn();
const updateSet = vi.fn();
const updateWhere = vi.fn();

/**
 * Condições `where` na ordem em que as queries são montadas.
 *
 * O mock não filtra nada — devolve o que o teste enfileirou, aconteça o que
 * acontecer com o `where`. Sem guardar a condição, um filtro a mais ou a
 * menos na query (ler só regras ativas, ou buscar pagamentos a partir do
 * piso errado) passa despercebido: o mock entrega as mesmas linhas nos dois
 * casos. Comparar a condição com a expressão drizzle esperada é a única
 * forma de exercer a query nesta suíte 100% mockada.
 */
const whereConds: unknown[] = [];

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (cond: unknown) => {
          whereConds.push(cond);
          return {
            orderBy: () => selectRows(),
            limit: () => selectLimitRows(),
          };
        },
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

// `resetAllMocks`, não `clearAllMocks`: clear zera as chamadas mas NÃO drena a
// fila de `mockResolvedValueOnce`. Um teste que enfileira dois retornos e
// consome só um (listBills sai cedo quando não há regra) deixava o resto da
// fila vazando para o teste seguinte, deslocando "regras" e "transações".

/** Linha de `payables` como o banco devolve — sobrescreva só o que importa. */
function payableRow(over: Record<string, unknown> = {}) {
  return {
    id: 1, tenant_id: 7, type: "despesa_fixa", category: "Aluguel",
    description: "Galpão", supplier: "Imobiliária Costa", amount_cents: 450_000,
    frequency: "mensal", first_due_date: "2026-06-10", installments: null,
    payment_method: "boleto", active: true, notes: null,
    created_at: "2026-06-01T00:00:00Z",
    ...over,
  };
}

describe("listBills", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    whereConds.length = 0;
  });

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

  it("mostra a conta única vencida há sete meses — janela não apaga dívida em aberto", async () => {
    selectRows
      .mockResolvedValueOnce([payableRow({
        frequency: "unica", first_due_date: "2026-01-15", category: "Multa Detran",
      })])
      .mockResolvedValueOnce([]);

    const { listBills } = await import("@/lib/db/payables");
    const bills = await listBills(7, "2026-08-13");

    expect(bills.map((b) => [b.due_date, b.status])).toEqual([["2026-01-15", "atrasado"]]);
    expect(bills[0].category).toBe("Multa Detran");
  });

  it("conta DESATIVADA mantém a parcela vencida em aberto e não gera futuro", async () => {
    // A query passa a ler regras inativas (includeInactive) — o recorte é
    // por ocorrência, em buildBills. Sem isso a linha some da aba, do badge
    // e do banner, e não sobra botão de "Registrar pagamento" em lugar nenhum.
    selectRows
      .mockResolvedValueOnce([payableRow({ active: false, first_due_date: "2026-06-10" })])
      .mockResolvedValueOnce([
        { payable_id: 1, due_date: "2026-06-10", transaction_id: 5, amount: 450_000 },
      ]);

    const { listBills } = await import("@/lib/db/payables");
    const bills = await listBills(7, "2026-08-13");

    // 06/10 pago some (está no livro-caixa); 07/10 e 08/10 seguem devidos;
    // 09/10 é futuro de regra desativada e não é gerado.
    expect(bills.map((b) => [b.due_date, b.status])).toEqual([
      ["2026-07-10", "atrasado"],
      ["2026-08-10", "atrasado"],
    ]);
  });

  it("busca pagamentos desde o vencimento mais antigo — não ressuscita conta já paga", async () => {
    selectRows
      .mockResolvedValueOnce([payableRow({
        frequency: "unica", first_due_date: "2026-01-15",
      })])
      .mockResolvedValueOnce([
        { payable_id: 1, due_date: "2026-01-15", transaction_id: 9, amount: 450_000 },
      ]);

    const { listBills } = await import("@/lib/db/payables");
    expect(await listBills(7, "2026-08-13")).toEqual([]);
  });

  it("a query de regras NÃO filtra por active — senão a dívida da conta desativada some", async () => {
    selectRows
      .mockResolvedValueOnce([payableRow({ active: false })])
      .mockResolvedValueOnce([]);

    const { listBills } = await import("@/lib/db/payables");
    await listBills(7, "2026-08-13");

    // Só o tenant. `and(..., eq(payables.active, true))` reprova aqui.
    expect(whereConds[0]).toEqual(eq(payables.tenant_id, 7));
  });

  it("a query de pagamentos desce até o vencimento mais antigo, não até o piso da janela", async () => {
    selectRows
      .mockResolvedValueOnce([
        payableRow({ id: 1, first_due_date: "2026-06-10" }),
        payableRow({ id: 2, first_due_date: "2026-01-15", frequency: "unica" }),
      ])
      .mockResolvedValueOnce([]);

    const { listBills } = await import("@/lib/db/payables");
    await listBills(7, "2026-08-13");

    // Piso = 2026-01-15 (o mais antigo entre as regras), não 2026-06-01
    // (window.from). Com o piso da janela, o pagamento de uma ocorrência
    // antiga não é encontrado e a conta quitada volta como "atrasado".
    expect(whereConds[1]).toEqual(and(
      eq(transactions.tenant_id, 7),
      isNotNull(transactions.payable_id),
      gte(transactions.due_date, "2026-01-15"),
      lte(transactions.due_date, "2026-09-30"),
    ));
  });
});

describe("countOverdue", () => {
  beforeEach(() => vi.resetAllMocks());

  it("conta o atraso anterior à janela — o badge da sidebar não mente", async () => {
    selectRows
      .mockResolvedValueOnce([payableRow({ frequency: "unica", first_due_date: "2026-01-15" })])
      .mockResolvedValueOnce([]);

    const { countOverdue } = await import("@/lib/db/payables");
    expect(await countOverdue(7, "2026-08-13")).toBe(1);
  });
});

describe("hasPaymentFor", () => {
  beforeEach(() => vi.resetAllMocks());

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
  beforeEach(() => vi.resetAllMocks());

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
  beforeEach(() => vi.resetAllMocks());

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
  beforeEach(() => vi.resetAllMocks());

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
