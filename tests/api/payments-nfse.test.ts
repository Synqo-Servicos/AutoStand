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

  // `registerNfse` (lib/db/payments.ts) só afeta uma linha quando
  // `nfse_issued_at` ainda é NULL — id inexistente e pagamento já
  // registrado convergem no mesmo "0 linhas afetadas" pro chamador; a
  // rota não distingue as duas causas e responde 409 nos dois casos (ver
  // comentário na rota). O nome do teste documenta o caso comum: registro
  // duplicado, não o edge case de id forjado.
  it("409 quando registerNfse não atualiza nada (nota já registrada)", async () => {
    sessionAs("contador", 7);
    registerNfse.mockResolvedValue(null);
    const { POST } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    const res = await POST(post({ numero: "123" }), ctx({ id: "999" }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/já tem NFS-e registrada/);
  });

  it("registrar duas vezes o mesmo pagamento — a 2ª tentativa dá 409 e não altera o número já gravado", async () => {
    sessionAs("contador", 7);
    const { POST } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    registerNfse.mockResolvedValueOnce({ id: 1, nfse_number: "111", nfse_issued_by: 7 });
    const first = await POST(post({ numero: "111" }), ctx({ id: "1" }));
    expect(first.status).toBe(200);

    // Na vida real é `registerNfse` (o UPDATE ... WHERE nfse_issued_at IS
    // NULL) quem devolve null na 2ª chamada — aqui simulamos exatamente
    // esse retorno, já que este arquivo mocka `@/lib/db` e não exercita o
    // SQL de verdade (isso é coberto em tests/lib/db/payments.test.ts).
    registerNfse.mockResolvedValueOnce(null);
    const second = await POST(post({ numero: "222 — tentativa de sobrescrever" }), ctx({ id: "1" }));
    const secondBody = await second.json();

    expect(second.status).toBe(409);
    expect(secondBody.error).toMatch(/já tem NFS-e registrada/);
    // "111" nunca aparece na resposta da 2ª tentativa — só o número da
    // primeira, já gravado, existe como fato.
    expect(secondBody).not.toHaveProperty("nfse_number", "222 — tentativa de sobrescrever");
  });

  it("400 quando o id não é numérico", async () => {
    sessionAs("contador", 7);
    const { POST } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    const res = await POST(post({ numero: "123" }), ctx({ id: "abc" }));

    expect(res.status).toBe(400);
    expect(registerNfse).not.toHaveBeenCalled();
  });

  it("400 quando o id é negativo", async () => {
    sessionAs("contador", 7);
    const { POST } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    const res = await POST(post({ numero: "123" }), ctx({ id: "-1" }));

    expect(res.status).toBe(400);
    expect(registerNfse).not.toHaveBeenCalled();
  });

  it("400 quando o id é zero", async () => {
    sessionAs("contador", 7);
    const { POST } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    const res = await POST(post({ numero: "123" }), ctx({ id: "0" }));

    expect(res.status).toBe(400);
    expect(registerNfse).not.toHaveBeenCalled();
  });
});
