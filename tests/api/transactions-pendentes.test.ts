import { describe, it, expect, vi, beforeEach } from "vitest";

const listPendingSales = vi.fn();

vi.mock("@/lib/db", () => ({ listPendingSales }));

// lib/api arrasta next-auth pro grafo do módulo. O withTenant falso injeta
// um tenantId fixo — o que importa aqui é o handler delegar com o tenant certo.
vi.mock("@/lib/api", () => ({
  ApiError: class extends Error {},
  withTenant:
    (handler: (req: unknown, ctx: { tenantId: number; params: Record<string, string> }) => unknown) =>
    (req: unknown) =>
      handler(req, { tenantId: 7, params: {} }),
}));

// `tsconfig.json` inclui **/*.ts, então o teste também é type-checked: a rota
// é tipada como (req, routeCtx) por causa do withTenant e precisa dos 2 args.
const req = () => ({ url: "http://x/api/transactions/pendentes" }) as never;
const ctx = { params: Promise.resolve({}) } as never;

const ONIX = {
  id: 1,
  brand: "Chevrolet",
  model: "Onix",
  year: 2022,
  sale_price: 79_900_00,
  primary_photo_url: null,
  updated_at: "2026-07-28T10:00:00.000Z",
};

describe("GET /api/transactions/pendentes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devolve as vendas pendentes do tenant da sessão", async () => {
    listPendingSales.mockResolvedValue([ONIX]);
    const { GET } = await import("@/app/api/transactions/pendentes/route");

    const res = await GET(req(), ctx);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([ONIX]);
    expect(listPendingSales).toHaveBeenCalledWith(7);
  });

  it("devolve lista vazia quando não há pendência", async () => {
    listPendingSales.mockResolvedValue([]);
    const { GET } = await import("@/app/api/transactions/pendentes/route");

    const res = await GET(req(), ctx);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([]);
  });
});
