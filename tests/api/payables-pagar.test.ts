import { describe, it, expect, vi, beforeEach } from "vitest";

const getPayable = vi.fn();
const hasPaymentFor = vi.fn();
const createTransaction = vi.fn();

vi.mock("@/lib/db", () => ({ getPayable, hasPaymentFor, createTransaction }));

// Mocka @/lib/auth e usa o `withTenant` REAL — padrão já estabelecido em
// tests/api/uploads-presign.test.ts e tests/api/vehicle-photos-delete.test.ts.
//
// Duas razões, ambas verificadas empiricamente:
//  1. `vi.importActual("@/lib/api")` quebra: a cadeia @/lib/api → @/lib/auth →
//     next-auth importa "next/server" sem extensão, que o resolvedor ESM do
//     Node usado pelo vitest não resolve.
//  2. Um `withTenant` falso não teria o try/catch que converte ApiError em
//     resposta HTTP — e é exatamente isso que os casos 400/404/409 abaixo
//     precisam exercitar. Com o wrapper real, um `throw` errado na rota
//     falha o teste de verdade.
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  getApiTenantId: vi.fn().mockResolvedValue(7),
}));

const post = (body: unknown) => ({ json: async () => body, url: "http://x" }) as never;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never;

const ALUGUEL = {
  id: 1, tenant_id: 7, type: "despesa_fixa", category: "Aluguel",
  amount_cents: 450_000, payment_method: "boleto",
};

const PAGAMENTO = {
  due_date: "2026-08-10",
  amount: 462_000,
  date: "2026-08-12",
  payment_method: "pix",
};

describe("POST /api/payables/[id]/pagar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPayable.mockResolvedValue(ALUGUEL);
    hasPaymentFor.mockResolvedValue(false);
    createTransaction.mockResolvedValue({ id: 99 });
  });

  it("cria a transação com tipo e categoria da conta", async () => {
    const { POST } = await import("@/app/api/payables/[id]/pagar/route");

    const res = await POST(post(PAGAMENTO), ctx("1"));

    expect(res.status).toBe(201);
    expect(createTransaction).toHaveBeenCalledWith(7, expect.objectContaining({
      type: "despesa_fixa",
      category: "Aluguel",
      amount: 462_000,       // o digitado, não o previsto
      date: "2026-08-12",    // data do pagamento
      due_date: "2026-08-10",// vencimento — os dois fatos sobrevivem
      payable_id: 1,
      payment_method: "pix", // sobrescreve o da conta
    }));
  });

  it("herda a forma de pagamento da conta quando não vem no body", async () => {
    const { POST } = await import("@/app/api/payables/[id]/pagar/route");
    const { payment_method: _drop, ...semMetodo } = PAGAMENTO;

    await POST(post(semMetodo), ctx("1"));

    expect(createTransaction).toHaveBeenCalledWith(7, expect.objectContaining({
      payment_method: "boleto",
    }));
  });

  it("409 quando o vencimento já foi pago", async () => {
    hasPaymentFor.mockResolvedValue(true);
    const { POST } = await import("@/app/api/payables/[id]/pagar/route");

    const res = await POST(post(PAGAMENTO), ctx("1"));

    expect(res.status).toBe(409);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("404 quando a conta é de outro tenant", async () => {
    getPayable.mockResolvedValue(null);
    const { POST } = await import("@/app/api/payables/[id]/pagar/route");
    const res = await POST(post(PAGAMENTO), ctx("999"));
    expect(res.status).toBe(404);
  });

  it("400 quando o valor é zero", async () => {
    const { POST } = await import("@/app/api/payables/[id]/pagar/route");
    const res = await POST(post({ ...PAGAMENTO, amount: 0 }), ctx("1"));
    expect(res.status).toBe(400);
    expect(createTransaction).not.toHaveBeenCalled();
  });
});
