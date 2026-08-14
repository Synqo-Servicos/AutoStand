import { describe, it, expect, vi, beforeEach } from "vitest";

const listBills = vi.fn();
const createPayable = vi.fn();
const updatePayable = vi.fn();

vi.mock("@/lib/db", () => ({ listBills, createPayable, updatePayable }));

// @/lib/api real importa @/lib/auth, que importa next-auth -> "next/server"
// sem extensão. O resolvedor ESM do Node usado pelo vitest não resolve esse
// specifier (só via require CJS), então importar @/lib/api sem mockar
// @/lib/auth quebra com "Cannot find module ... next/server". Em vez de
// substituir `withTenant` por um fake (que perderia o try/catch que converte
// ApiError em resposta HTTP — é justamente o que este teste precisa exercitar
// nos casos 400/404), usamos o `withTenant` real e só fixamos o tenant da
// sessão mockando `getApiTenantId`.
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  getApiTenantId: vi.fn().mockResolvedValue(7),
}));

const post = (body: unknown) =>
  ({ json: async () => body, url: "http://x/api/payables" }) as never;

const ctx = (params: Record<string, string> = {}) =>
  ({ params: Promise.resolve(params) }) as never;

const VALID = {
  type: "despesa_fixa",
  category: "Aluguel",
  description: "Galpão",
  supplier: "Imobiliária Costa",
  amount_cents: 450_000,
  frequency: "mensal",
  first_due_date: "2026-09-10",
  installments: null,
  payment_method: "boleto",
};

describe("GET /api/payables", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devolve as contas do tenant da sessão", async () => {
    listBills.mockResolvedValue([{ payable_id: 1, due_date: "2026-09-10", status: "a_vencer" }]);
    const { GET } = await import("@/app/api/payables/route");

    const res = await GET({ url: "http://x/api/payables" } as never, ctx());

    expect(res.status).toBe(200);
    expect(listBills).toHaveBeenCalledWith(7, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });
});

describe("POST /api/payables", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cria a regra e devolve 201", async () => {
    createPayable.mockResolvedValue({ id: 1, ...VALID });
    const { POST } = await import("@/app/api/payables/route");

    const res = await POST(post(VALID), ctx());

    expect(res.status).toBe(201);
    expect(createPayable).toHaveBeenCalledWith(7, expect.objectContaining({ category: "Aluguel" }));
  });

  it("400 quando a frequência é inválida", async () => {
    const { POST } = await import("@/app/api/payables/route");
    const res = await POST(post({ ...VALID, frequency: "semanal" }), ctx());
    expect(res.status).toBe(400);
    expect(createPayable).not.toHaveBeenCalled();
  });

  it("400 quando conta única vem parcelada", async () => {
    const { POST } = await import("@/app/api/payables/route");
    const res = await POST(post({ ...VALID, frequency: "unica", installments: 3 }), ctx());
    expect(res.status).toBe(400);
  });

  it("400 quando o vencimento não é uma data ISO", async () => {
    const { POST } = await import("@/app/api/payables/route");
    const res = await POST(post({ ...VALID, first_due_date: "10/09/2026" }), ctx());
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/payables/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("desativa a conta", async () => {
    updatePayable.mockResolvedValue({ id: 1, active: false });
    const { PATCH } = await import("@/app/api/payables/[id]/route");

    const res = await PATCH(post({ active: false }), ctx({ id: "1" }));

    expect(res.status).toBe(200);
    expect(updatePayable).toHaveBeenCalledWith(7, 1, { active: false });
  });

  it("404 quando a conta é de outro tenant", async () => {
    updatePayable.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/payables/[id]/route");
    const res = await PATCH(post({ active: false }), ctx({ id: "999" }));
    expect(res.status).toBe(404);
  });
});
