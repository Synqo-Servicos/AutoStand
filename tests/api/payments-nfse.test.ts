import { describe, it, expect, vi, beforeEach } from "vitest";

const registerNfse = vi.fn();

vi.mock("@/lib/db", () => ({ registerNfse }));

// Mesmo motivo do tests/api/payables.test.ts: @/lib/finance-access importa
// @/lib/auth (que importa next-auth -> "next/server" sem extensão, e o
// resolvedor ESM do vitest não resolve esse specifier). Em vez de trocar
// `withFinanceAccess` por um fake — o que perderia o try/catch que converte
// ApiError/ZodError em resposta HTTP, justamente o que os casos 400/401
// precisam exercitar — usamos o wrapper real e só fixamos a sessão mockando
// `auth`.
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  getApiTenantId: vi.fn(),
}));

import { auth } from "@/lib/auth";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

function sessionAs(role: string, id: number) {
  mockAuth.mockResolvedValue({ user: { id, role } });
}

function noSession() {
  mockAuth.mockResolvedValue(null);
}

const post = (body: unknown) =>
  ({ json: async () => body, url: "http://x/api/superadmin/payments/1/nfse" }) as never;

const ctx = (params: Record<string, string> = { id: "1" }) =>
  ({ params: Promise.resolve(params) }) as never;

describe("POST /api/superadmin/payments/[id]/nfse", () => {
  beforeEach(() => vi.clearAllMocks());

  it("contador consegue registrar a NFS-e", async () => {
    sessionAs("contador", 7);
    registerNfse.mockResolvedValue({ id: 1, nfse_number: "2026/123", nfse_issued_by: 7 });
    const { POST } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    const res = await POST(post({ numero: "2026/123" }), ctx());

    expect(res.status).toBe(200);
    expect(registerNfse).toHaveBeenCalledWith(1, "2026/123", 7);
  });

  it("super_admin também consegue registrar", async () => {
    sessionAs("super_admin", 1);
    registerNfse.mockResolvedValue({ id: 1, nfse_number: "999", nfse_issued_by: 1 });
    const { POST } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    const res = await POST(post({ numero: "999" }), ctx());

    expect(res.status).toBe(200);
    expect(registerNfse).toHaveBeenCalledWith(1, "999", 1);
  });

  it("tenant_admin recebe 401 e não chega a gravar", async () => {
    sessionAs("tenant_admin", 3);
    const { POST } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    const res = await POST(post({ numero: "123" }), ctx());

    expect(res.status).toBe(401);
    expect(registerNfse).not.toHaveBeenCalled();
  });

  it("sem sessão recebe 401", async () => {
    noSession();
    const { POST } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    const res = await POST(post({ numero: "123" }), ctx());

    expect(res.status).toBe(401);
    expect(registerNfse).not.toHaveBeenCalled();
  });

  it("400 quando o número vem vazio", async () => {
    sessionAs("contador", 7);
    const { POST } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    const res = await POST(post({ numero: "" }), ctx());

    expect(res.status).toBe(400);
    expect(registerNfse).not.toHaveBeenCalled();
  });

  it("400 quando o número não vem no body", async () => {
    sessionAs("contador", 7);
    const { POST } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    const res = await POST(post({}), ctx());

    expect(res.status).toBe(400);
    expect(registerNfse).not.toHaveBeenCalled();
  });

  it("grava nfse_issued_by com o id da sessão, não um valor do body", async () => {
    sessionAs("contador", 55);
    registerNfse.mockResolvedValue({ id: 2, nfse_number: "abc", nfse_issued_by: 55 });
    const { POST } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    // Tenta injetar um userId diferente pelo body — a rota nunca lê isso;
    // usa só o ctx.userId que withFinanceAccess extrai da sessão.
    await POST(post({ numero: "abc", nfse_issued_by: 999 }), ctx({ id: "2" }));

    expect(registerNfse).toHaveBeenCalledWith(2, "abc", 55);
  });

  it("404 quando o pagamento não existe", async () => {
    sessionAs("contador", 7);
    registerNfse.mockResolvedValue(null);
    const { POST } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    const res = await POST(post({ numero: "123" }), ctx({ id: "999" }));

    expect(res.status).toBe(404);
  });
});
