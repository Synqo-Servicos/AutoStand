import { describe, it, expect, vi, beforeEach } from "vitest";

// `vi.hoisted` e não `const fn = vi.fn()`: o `vi.mock` abaixo é içado pro
// topo do módulo e, se a factory rodasse antes da inicialização do const, o
// TDZ travaria o vitest em silêncio em vez de dar erro.
const { registerNfse, clearNfse, getPaymentById } = vi.hoisted(() => ({
  registerNfse: vi.fn(),
  clearNfse: vi.fn(),
  getPaymentById: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ registerNfse, clearNfse, getPaymentById }));

/** Linha aprovada e ainda sem nota — o caso que a fila mostra. */
const aprovadoSemNota = { id: 1, status: "approved", nfse_issued_at: null, nfse_number: null };
/** Linha já carimbada — o 409 clássico de registro duplicado. */
const jaComNota = {
  id: 1, status: "approved", nfse_issued_at: "2026-08-16T10:00:00Z", nfse_number: "111",
};
/** Linha que a fila nunca mostra — o alvo do carimbo em massa. */
const estornado = { id: 1, status: "refunded", nfse_issued_at: null, nfse_number: null };

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

  // `registerNfse` (lib/db/payments.ts) só afeta uma linha quando o status é
  // elegível E `nfse_issued_at` ainda é NULL. As TRÊS causas de "0 linhas
  // afetadas" convergem no mesmo `null` para o chamador; a rota separa as
  // três com um `getPaymentById` — feito só no caminho de erro — para que a
  // mensagem seja a causa real, não uma adivinhação.
  it("409 quando o pagamento já tem nota — a causa vem do estado real da linha", async () => {
    sessionAs("contador", 7);
    registerNfse.mockResolvedValue(null);
    getPaymentById.mockResolvedValue(jaComNota);
    const { POST } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    const res = await POST(post({ numero: "123" }), ctx({ id: "1" }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/já tem NFS-e registrada/);
  });

  it("404 quando o pagamento não existe — não é confundido com 'já tem nota'", async () => {
    sessionAs("contador", 7);
    registerNfse.mockResolvedValue(null);
    getPaymentById.mockResolvedValue(null);
    const { POST } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    const res = await POST(post({ numero: "123" }), ctx({ id: "999" }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/não encontrado/i);
  });

  /**
   * O achado: o contador varre ids 1..N com POST e carimba tudo, inclusive
   * linhas que a UI nunca mostra. O bloqueio de verdade é o predicado de
   * status no WHERE de `registerNfse` (provado em tests/lib/db/payments.ts,
   * onde o SQL é compilado). Aqui se prova o outro lado: a rota não
   * transforma esse bloqueio num sucesso silencioso nem numa mensagem
   * enganosa.
   */
  it("422 quando o status não gera nota — estorno não vira NFS-e", async () => {
    sessionAs("contador", 7);
    registerNfse.mockResolvedValue(null);
    getPaymentById.mockResolvedValue(estornado);
    const { POST } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    const res = await POST(post({ numero: "123" }), ctx({ id: "1" }));
    const body = await res.json();

    expect(res.status).toBe(422);
    // A mensagem nomeia o status real — o contador precisa saber POR QUE,
    // não só que "deu erro".
    expect(body.error).toMatch(/refunded/);
    expect(body.error).not.toMatch(/já tem NFS-e/);
  });

  it("as três causas de falha produzem status HTTP distintos", async () => {
    sessionAs("contador", 7);
    registerNfse.mockResolvedValue(null);
    const { POST } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    getPaymentById.mockResolvedValueOnce(null);
    const inexistente = await POST(post({ numero: "1" }), ctx({ id: "1" }));
    getPaymentById.mockResolvedValueOnce(jaComNota);
    const duplicado = await POST(post({ numero: "1" }), ctx({ id: "1" }));
    getPaymentById.mockResolvedValueOnce(estornado);
    const invalido = await POST(post({ numero: "1" }), ctx({ id: "1" }));

    expect([inexistente.status, duplicado.status, invalido.status]).toEqual([404, 409, 422]);
  });

  it("nenhuma falha responde 2xx — carimbo que não pegou nunca vira sucesso silencioso", async () => {
    sessionAs("contador", 7);
    registerNfse.mockResolvedValue(null);
    const { POST } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    for (const linha of [null, jaComNota, estornado]) {
      getPaymentById.mockResolvedValueOnce(linha);
      const res = await POST(post({ numero: "1" }), ctx({ id: "1" }));
      expect(res.ok).toBe(false);
    }
  });

  it("registrar duas vezes o mesmo pagamento — a 2ª tentativa dá 409 e não altera o número já gravado", async () => {
    sessionAs("contador", 7);
    const { POST } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    registerNfse.mockResolvedValueOnce({ id: 1, nfse_number: "111", nfse_issued_by: 7 });
    const first = await POST(post({ numero: "111" }), ctx({ id: "1" }));
    expect(first.status).toBe(200);

    // Na vida real é `registerNfse` (o UPDATE ... WHERE status elegível AND
    // nfse_issued_at IS NULL) quem devolve null na 2ª chamada — aqui
    // simulamos exatamente esse retorno, já que este arquivo mocka
    // `@/lib/db` e não exercita o SQL de verdade (isso é coberto em
    // tests/lib/db/payments.test.ts).
    registerNfse.mockResolvedValueOnce(null);
    getPaymentById.mockResolvedValueOnce(jaComNota);
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

/**
 * Caminho de reversão. Antes dele, `registerNfse` era a única escrita em
 * `nfse_*` no sistema inteiro: número digitado errado era permanente e
 * desfazer exigia acesso direto ao Postgres de produção.
 *
 * A assimetria de papel é o ponto: `withSuperAdmin`, não
 * `withFinanceAccess`. O `contador` carimba (POST) mas não descarimba
 * (DELETE) — senão a credencial mais fraca do console ganharia, junto com o
 * poder de errar, o poder de apagar o rastro do erro.
 */
describe("DELETE /api/superadmin/payments/[id]/nfse", () => {
  beforeEach(() => vi.clearAllMocks());

  it("contador NÃO pode desfazer — 401 e clearNfse nem é chamado", async () => {
    sessionAs("contador", 7);
    const { DELETE } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    const res = await DELETE(post({}), ctx({ id: "1" }));

    expect(res.status).toBe(401);
    expect(clearNfse).not.toHaveBeenCalled();
  });

  it("super_admin desfaz e recebe a linha limpa de volta", async () => {
    sessionAs("super_admin", 1);
    clearNfse.mockResolvedValue({ ...aprovadoSemNota, nfse_issued_by: null });
    const { DELETE } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    const res = await DELETE(post({}), ctx({ id: "1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(clearNfse).toHaveBeenCalledWith(1);
    // A linha volta pra fila: sem número, sem data, sem autor.
    expect(body.nfse_issued_at).toBeNull();
    expect(body.nfse_number).toBeNull();
    expect(body.nfse_issued_by).toBeNull();
  });

  it("tenant_admin recebe 401", async () => {
    sessionAs("tenant_admin", 3);
    const { DELETE } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    expect((await DELETE(post({}), ctx({ id: "1" }))).status).toBe(401);
    expect(clearNfse).not.toHaveBeenCalled();
  });

  it("sem sessão recebe 401", async () => {
    noSession();
    const { DELETE } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    expect((await DELETE(post({}), ctx({ id: "1" }))).status).toBe(401);
    expect(clearNfse).not.toHaveBeenCalled();
  });

  it("404 quando o pagamento não existe", async () => {
    sessionAs("super_admin", 1);
    clearNfse.mockResolvedValue(null);
    getPaymentById.mockResolvedValue(null);
    const { DELETE } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    const res = await DELETE(post({}), ctx({ id: "999" }));

    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/não encontrado/i);
  });

  it("409 quando o pagamento não tem nota a desfazer", async () => {
    sessionAs("super_admin", 1);
    clearNfse.mockResolvedValue(null);
    getPaymentById.mockResolvedValue(aprovadoSemNota);
    const { DELETE } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    const res = await DELETE(post({}), ctx({ id: "1" }));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/não tem NFS-e/i);
  });

  it("400 quando o id é inválido — mesma validação do POST", async () => {
    sessionAs("super_admin", 1);
    const { DELETE } = await import("@/app/api/superadmin/payments/[id]/nfse/route");

    for (const id of ["abc", "-1", "0"]) {
      const res = await DELETE(post({}), ctx({ id }));
      expect(res.status).toBe(400);
    }
    expect(clearNfse).not.toHaveBeenCalled();
  });
});
