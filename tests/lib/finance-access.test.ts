import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { hasFinanceAccess } from "@/lib/finance-access";

describe("hasFinanceAccess", () => {
  it("aceita super_admin e contador", () => {
    expect(hasFinanceAccess("super_admin")).toBe(true);
    expect(hasFinanceAccess("contador")).toBe(true);
  });
  it("nega tenant_admin, indefinido e papel inventado", () => {
    expect(hasFinanceAccess("tenant_admin")).toBe(false);
    expect(hasFinanceAccess(undefined)).toBe(false);
    expect(hasFinanceAccess("admin")).toBe(false);
  });
});

// `vi.hoisted` em vez de um `const auth = vi.fn()` solto: a chamada de
// `vi.mock` é içada para o topo do arquivo, então a fábrica roda ANTES do
// corpo do módulo. Com um const normal ela lê `auth` na TDZ e o vitest 4
// trava sem reportar erro (verificado empiricamente — ver relatório).
const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth, getApiTenantId: vi.fn() }));

describe("withFinanceAccess", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deixa o contador passar", async () => {
    auth.mockResolvedValue({ user: { id: "3", role: "contador" } });
    const { withFinanceAccess } = await import("@/lib/finance-access");
    const h = withFinanceAccess(async (_r, ctx) =>
      new Response(JSON.stringify({ userId: ctx.userId }), { status: 200 }));
    const res = await h({} as never, { params: Promise.resolve({}) } as never);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ userId: 3 });
  });

  it("nega tenant_admin", async () => {
    auth.mockResolvedValue({ user: { id: "9", role: "tenant_admin" } });
    const { withFinanceAccess } = await import("@/lib/finance-access");
    const h = withFinanceAccess(async () => new Response("ok"));
    const res = await h({} as never, { params: Promise.resolve({}) } as never);
    expect(res.status).toBe(401);
  });

  // Afirmar sobre o ARGUMENTO capturado, não sobre o retorno do mock: o 401
  // sozinho não prova que o handler não rodou — provaria só que a resposta
  // dele foi descartada. Aqui o handler é o dublê e o teste olha as chamadas.
  it("negado é negado antes do handler — o handler nem é chamado", async () => {
    auth.mockResolvedValue({ user: { id: "9", role: "tenant_admin" } });
    const { withFinanceAccess } = await import("@/lib/finance-access");
    const handler = vi.fn(async () => new Response("ok"));
    const h = withFinanceAccess(handler);
    const res = await h({} as never, { params: Promise.resolve({}) } as never);
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("entrega ao handler o userId da sessão e os params já resolvidos", async () => {
    auth.mockResolvedValue({ user: { id: "7", role: "super_admin" } });
    const { withFinanceAccess } = await import("@/lib/finance-access");
    const handler = vi.fn(
      async (_req: unknown, _ctx: { userId: number; params: Record<string, string> }) =>
        new Response("ok"),
    );
    const req = { method: "POST" } as never;
    const h = withFinanceAccess(handler);
    const res = await h(req, { params: Promise.resolve({ id: "42" }) } as never);

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    const [reqArg, ctxArg] = handler.mock.calls[0];
    expect(reqArg).toBe(req);
    expect(ctxArg).toEqual({ userId: 7, params: { id: "42" } });
  });

  it("nega sessão ausente", async () => {
    auth.mockResolvedValue(null);
    const { withFinanceAccess } = await import("@/lib/finance-access");
    const handler = vi.fn(async () => new Response("ok"));
    const res = await withFinanceAccess(handler)(
      {} as never,
      { params: Promise.resolve({}) } as never,
    );
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("auth() quebrado é 401, não 500 — falha de sessão nega, não abre", async () => {
    auth.mockRejectedValue(new Error("JWT_SESSION_ERROR"));
    const { withFinanceAccess } = await import("@/lib/finance-access");
    const handler = vi.fn(async () => new Response("ok"));
    const res = await withFinanceAccess(handler)(
      {} as never,
      { params: Promise.resolve({}) } as never,
    );
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("converte ApiError do handler no status certo (não vaza 500)", async () => {
    auth.mockResolvedValue({ user: { id: "3", role: "contador" } });
    const [{ withFinanceAccess }, { ApiError }] = await Promise.all([
      import("@/lib/finance-access"),
      import("@/lib/api"),
    ]);
    const h = withFinanceAccess(async () => {
      throw new ApiError("Nota já registrada.", 409);
    });
    const res = await h({} as never, { params: Promise.resolve({}) } as never);
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "Nota já registrada." });
  });
});

describe("withSuperAdmin não afrouxa", () => {
  beforeEach(() => vi.clearAllMocks());

  it("continua negando o contador — é o que garante que página nova nasça fechada", async () => {
    auth.mockResolvedValue({ user: { id: "3", role: "contador" } });
    const { withSuperAdmin } = await import("@/lib/api");
    const handler = vi.fn(async () => new Response("ok"));
    const h = withSuperAdmin(handler);
    const res = await h({} as never, { params: Promise.resolve({}) } as never);
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("segue deixando o super_admin passar — negar o contador não quebrou o wrapper", async () => {
    auth.mockResolvedValue({ user: { id: "1", role: "super_admin" } });
    const { withSuperAdmin } = await import("@/lib/api");
    const res = await withSuperAdmin(async () => new Response("ok"))(
      {} as never,
      { params: Promise.resolve({}) } as never,
    );
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Isolamento estrutural. Os testes acima provam o comportamento dos wrappers;
// estes provam a propriedade que a task existe para garantir: **coisa nova
// nasce fechada ao contador**. Eles falham no dia em que alguém cria uma
// página ou rota fora de um gate, ou afrouxa o gate de (panel).
// ---------------------------------------------------------------------------

describe("isolamento por route group — página nova nasce fechada", () => {
  const superadminDir = path.join(process.cwd(), "app", "superadmin");

  /**
   * Páginas de /superadmin fora de um route group gateado. Cada uma faz a
   * própria checagem e está aqui por decisão consciente:
   *  - login: pública por definição;
   *  - trocar-senha: fica fora de (panel) de propósito, senão o redirect de
   *    senha provisória viraria loop (ver comentário no próprio arquivo).
   * Página nova NÃO entra nesta lista por acidente — entra por edição.
   */
  const PAGINAS_SEM_GRUPO = ["login/page.tsx", "trocar-senha/page.tsx"];

  function paginasDe(dir: string, prefixo = ""): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const rel = prefixo ? `${prefixo}/${entry.name}` : entry.name;
      if (entry.isDirectory()) return paginasDe(path.join(dir, entry.name), rel);
      return entry.name === "page.tsx" ? [rel] : [];
    });
  }

  it("toda página de /superadmin está num route group com gate de papel", () => {
    const gateadas = (p: string) => p.startsWith("(panel)/") || p.startsWith("(financeiro)/");
    const semGrupo = paginasDe(superadminDir).filter((p) => !gateadas(p));
    expect(semGrupo.sort()).toEqual([...PAGINAS_SEM_GRUPO].sort());
  });

  it("o layout de (panel) não concede acesso a papel de financeiro", () => {
    const source = readFileSync(path.join(superadminDir, "(panel)", "layout.tsx"), "utf8");
    expect(source).toContain('role !== "super_admin"');
    expect(source).not.toMatch(/contador|FinanceAccess/);
  });

  it("o layout de (financeiro) gateia pelo mesmo predicado das rotas", () => {
    const layout = path.join(superadminDir, "(financeiro)", "layout.tsx");
    expect(existsSync(layout)).toBe(true);
    const source = readFileSync(layout, "utf8");
    expect(source).toMatch(/hasFinanceAccess\(/);
    expect(source).toMatch(/redirect\("\/superadmin\/login"\)/);
  });
});

describe("isolamento nas rotas — rota nova nasce fechada", () => {
  const apiDir = path.join(process.cwd(), "app", "api", "superadmin");
  const METODOS = "GET|POST|PUT|PATCH|DELETE";

  function rotasDe(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return rotasDe(full);
      return entry.name === "route.ts" ? [full] : [];
    });
  }

  it("todo handler em /api/superadmin sai de withSuperAdmin ou withFinanceAccess", () => {
    const rotas = rotasDe(apiDir);
    expect(rotas.length).toBeGreaterThan(0);

    const semWrapper: string[] = [];
    for (const rota of rotas) {
      const source = readFileSync(rota, "utf8");
      const rel = path.relative(process.cwd(), rota);

      // Forma `export async function GET(...)` — handler cru, sem wrapper.
      if (new RegExp(`export\\s+async\\s+function\\s+(${METODOS})\\b`).test(source)) {
        semWrapper.push(`${rel} (handler cru)`);
      }
      // Forma `export const GET = <wrapper>(...)`.
      const atribuicoes = source.matchAll(
        new RegExp(`export\\s+const\\s+(${METODOS})\\s*=\\s*(\\w+)`, "g"),
      );
      for (const [, metodo, wrapper] of atribuicoes) {
        if (wrapper !== "withSuperAdmin" && wrapper !== "withFinanceAccess") {
          semWrapper.push(`${rel} → ${metodo} via ${wrapper}`);
        }
      }
    }

    expect(semWrapper).toEqual([]);
  });
});
