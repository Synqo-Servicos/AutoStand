import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Trava a falha cross-tenant que estava em produção no PATCH /api/personalizar:
 * `logo_url` / `layout_config.heroImageUrl` eram string livre do cliente, e o
 * cleanup de órfãos chamava `deleteFromBlob` na referência ANTIGA. Dois
 * requests apagavam do bucket o arquivo de OUTRA loja (as URLs saem no HTML
 * público da vitrine):
 *
 *   PATCH {"logo_url":"https://cdn.../tenants/99/vehicles/12/....jpg"} → 200
 *   PATCH {"logo_url":""}                                             → delete
 *
 * Mesmo padrão de tests/api/payables-anexos.test.ts: `withTenant` REAL, só
 * `@/lib/auth` e `@/lib/db` mockados — um withTenant falso não exerceria o
 * try/catch que converte ApiError em 400, que é metade do que se testa aqui.
 */

const getTenantById = vi.fn();
const updateTenant = vi.fn();
vi.mock("@/lib/db", () => ({ getTenantById, updateTenant }));

const deleteFromBlob = vi.fn();
vi.mock("@/lib/blob", () => ({
  deleteFromBlob,
  // Espelha produção (CDN_URL=https://cdn.autostand.com.br) — sem depender de env.
  publicUrlForKey: (key: string) => `https://cdn.autostand.com.br/${key}`,
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  getApiTenantId: vi.fn().mockResolvedValue(7),
}));

const patch = (body: unknown) => ({ json: async () => body }) as never;
const ctx = () => ({ params: Promise.resolve({}) }) as never;

const CDN = "https://cdn.autostand.com.br";

const MY_LOGO_KEY = "tenants/7/branding/logo/1700000000000-abc123.png";
const MY_LOGO_URL = `${CDN}/${MY_LOGO_KEY}`;
const NEW_LOGO_KEY = "tenants/7/branding/logo/1700000000111-def456.png";
const NEW_LOGO_URL = `${CDN}/${NEW_LOGO_KEY}`;

const MY_HERO_KEY = "tenants/7/branding/hero/1700000000000-hero11.webp";
const MY_HERO_URL = `${CDN}/${MY_HERO_KEY}`;
const NEW_HERO_KEY = "tenants/7/branding/hero/1700000000222-hero22.webp";
const NEW_HERO_URL = `${CDN}/${NEW_HERO_KEY}`;

/** Alvos da loja 99 — descobertos no HTML público da vitrine dela. */
const VICTIM_PHOTO_URL = `${CDN}/tenants/99/vehicles/12/1700000000000-xyz999.jpg`;
const VICTIM_LOGO_URL = `${CDN}/tenants/99/branding/logo/1700000000000-xyz999.png`;
const VICTIM_HERO_URL = `${CDN}/tenants/99/branding/hero/1700000000000-xyz999.webp`;
const VICTIM_PHOTO_KEY = "tenants/99/vehicles/12/1700000000000-xyz999.jpg";

/** Hero externo (o seed usa Unsplash) — dado legítimo que não é objeto nosso. */
const EXTERNAL_HERO =
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=80";

function tenant(over: Record<string, unknown> = {}) {
  return {
    id: 7,
    plan: "pro", // capability layoutConfig ligada — necessária pro hero
    logo_url: MY_LOGO_URL,
    layout_config: { heroStyle: "image", heroImageUrl: MY_HERO_URL, cardStyle: "elevated", cardsPerRow: 3 },
    ...over,
  };
}

const route = () => import("@/app/api/personalizar/route");

beforeEach(() => {
  vi.clearAllMocks();
  getTenantById.mockResolvedValue(tenant());
  updateTenant.mockImplementation(async (_id: number, p: Record<string, unknown>) => ({
    ...tenant(),
    ...p,
  }));
  deleteFromBlob.mockResolvedValue(undefined);
});

describe("PATCH /api/personalizar — logo (guarda cross-tenant)", () => {
  it("400 na URL de logo de outra loja — não grava nem apaga nada", async () => {
    const { PATCH } = await route();
    const res = await PATCH(patch({ logo_url: VICTIM_LOGO_URL }), ctx());
    expect(res.status).toBe(400);
    expect(updateTenant).not.toHaveBeenCalled();
    expect(deleteFromBlob).not.toHaveBeenCalled();
  });

  it("400 na URL de FOTO DE VEÍCULO de outra loja (o alvo do exploit original)", async () => {
    const { PATCH } = await route();
    const res = await PATCH(patch({ logo_url: VICTIM_PHOTO_URL }), ctx());
    expect(res.status).toBe(400);
    expect(updateTenant).not.toHaveBeenCalled();
  });

  it("400 na key crua de outra loja", async () => {
    const { PATCH } = await route();
    const res = await PATCH(patch({ logo_url: VICTIM_PHOTO_KEY }), ctx());
    expect(res.status).toBe(400);
    expect(updateTenant).not.toHaveBeenCalled();
  });

  it("400 em key da pasta certa mas de outro tipo/pasta do próprio tenant", async () => {
    const { PATCH } = await route();
    const res = await PATCH(
      patch({ logo_url: "tenants/7/vehicles/3/1700000000000-abc123.jpg" }),
      ctx(),
    );
    expect(res.status).toBe(400);
    expect(updateTenant).not.toHaveBeenCalled();
  });

  it("400 em referência que não é URL nem key (//host, javascript:)", async () => {
    const { PATCH } = await route();
    for (const bad of ["//evil.example.com/x.png", "javascript:alert(1)"]) {
      const res = await PATCH(patch({ logo_url: bad }), ctx());
      expect(res.status, bad).toBe(400);
    }
    expect(updateTenant).not.toHaveBeenCalled();
  });

  it("aceita a KEY deste tenant e deriva a URL no servidor", async () => {
    const { PATCH } = await route();
    const res = await PATCH(patch({ logo_url: NEW_LOGO_KEY }), ctx());
    expect(res.status).toBe(200);
    expect(updateTenant).toHaveBeenCalledWith(7, expect.objectContaining({ logo_url: NEW_LOGO_URL }));
  });

  it("aceita a URL pública deste tenant — compat com o que já está gravado", async () => {
    const { PATCH } = await route();
    const res = await PATCH(patch({ logo_url: NEW_LOGO_URL }), ctx());
    expect(res.status).toBe(200);
    expect(updateTenant).toHaveBeenCalledWith(7, expect.objectContaining({ logo_url: NEW_LOGO_URL }));
  });

  it("apaga o logo antigo do PRÓPRIO tenant (o cleanup continua funcionando)", async () => {
    const { PATCH } = await route();
    const res = await PATCH(patch({ logo_url: NEW_LOGO_KEY }), ctx());
    expect(res.status).toBe(200);
    expect(deleteFromBlob).toHaveBeenCalledWith(MY_LOGO_URL);
  });
});

describe("PATCH /api/personalizar — hero (guarda cross-tenant)", () => {
  const layout = (heroImageUrl: string | null) => ({
    layout_config: { heroStyle: "image", heroImageUrl, cardStyle: "elevated", cardsPerRow: 3 },
  });

  it("400 no hero de outra loja — não grava nem apaga nada", async () => {
    const { PATCH } = await route();
    const res = await PATCH(patch(layout(VICTIM_HERO_URL)), ctx());
    expect(res.status).toBe(400);
    expect(updateTenant).not.toHaveBeenCalled();
    expect(deleteFromBlob).not.toHaveBeenCalled();
  });

  it("aceita a key de hero deste tenant e apaga o hero antigo dele", async () => {
    const { PATCH } = await route();
    const res = await PATCH(patch(layout(NEW_HERO_KEY)), ctx());
    expect(res.status).toBe(200);
    expect(updateTenant).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        layout_config: expect.objectContaining({ heroImageUrl: NEW_HERO_URL }),
      }),
    );
    expect(deleteFromBlob).toHaveBeenCalledWith(MY_HERO_URL);
  });

  it("hero externo (seed/Unsplash) continua aceito e nunca vira delete", async () => {
    getTenantById.mockResolvedValue(
      tenant({ layout_config: { heroStyle: "image", heroImageUrl: EXTERNAL_HERO, cardStyle: "elevated", cardsPerRow: 3 } }),
    );
    const { PATCH } = await route();

    const keep = await PATCH(patch(layout(EXTERNAL_HERO)), ctx());
    expect(keep.status).toBe(200);
    expect(deleteFromBlob).not.toHaveBeenCalled();

    const swap = await PATCH(patch(layout(NEW_HERO_KEY)), ctx());
    expect(swap.status).toBe(200);
    expect(deleteFromBlob).not.toHaveBeenCalled();
  });

  it("plano sem a capability ignora layout_config (gating segue no servidor)", async () => {
    getTenantById.mockResolvedValue(tenant({ plan: "basico" }));
    const { PATCH } = await route();
    const res = await PATCH(patch({ ...layout(NEW_HERO_KEY), slogan: "oi" }), ctx());
    expect(res.status).toBe(200);
    expect(updateTenant).toHaveBeenCalledWith(7, expect.not.objectContaining({ layout_config: expect.anything() }));
  });
});

describe("PATCH /api/personalizar — linha já envenenada em produção", () => {
  // O banco pode ter URL alheia gravada ANTES da correção (a rota aceitava
  // string livre). A segunda barreira mantém esse objeto fora do delete.
  it("não apaga o blob alheio que já estava gravado como logo", async () => {
    getTenantById.mockResolvedValue(tenant({ logo_url: VICTIM_PHOTO_URL }));
    const { PATCH } = await route();
    const res = await PATCH(patch({ logo_url: NEW_LOGO_KEY }), ctx());
    expect(res.status).toBe(200);
    expect(deleteFromBlob).not.toHaveBeenCalled();
    expect(deleteFromBlob).not.toHaveBeenCalledWith(VICTIM_PHOTO_URL);
  });

  it("não apaga o blob alheio que já estava gravado como hero", async () => {
    getTenantById.mockResolvedValue(
      tenant({
        layout_config: { heroStyle: "image", heroImageUrl: VICTIM_HERO_URL, cardStyle: "elevated", cardsPerRow: 3 },
      }),
    );
    const { PATCH } = await route();
    const res = await PATCH(
      patch({ layout_config: { heroStyle: "image", heroImageUrl: null, cardStyle: "elevated", cardsPerRow: 3 } }),
      ctx(),
    );
    expect(res.status).toBe(200);
    expect(deleteFromBlob).not.toHaveBeenCalled();
  });

  it("remover o logo (null) apaga só o objeto do próprio tenant", async () => {
    const { PATCH } = await route();
    const res = await PATCH(patch({ logo_url: null }), ctx());
    expect(res.status).toBe(200);
    expect(updateTenant).toHaveBeenCalledWith(7, expect.objectContaining({ logo_url: null }));
    expect(deleteFromBlob).toHaveBeenCalledWith(MY_LOGO_URL);
  });
});
