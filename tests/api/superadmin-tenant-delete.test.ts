import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Trava a mesma falha cross-tenant de 1b04c4b, na porta do super-admin.
 *
 * Excluir uma concessionária varre os blobs dela e chama `deleteFromBlob` em
 * cada URL vinda do banco. Só que URL no banco não é prova de posse: o código
 * de branding vulnerável aceitava gravar em `logo_url`/`heroImageUrl` a URL do
 * arquivo de OUTRA loja. Com uma linha dessas, excluir a Loja A apagaria do
 * bucket o logo da Loja B — sem que ninguém tocasse na Loja B.
 *
 * Mesmo padrão de tests/api/personalizar-branding.test.ts: `withSuperAdmin`
 * REAL (só `@/lib/auth` mockado), pra exercer o handler de verdade.
 */

const listTenantBlobRefs = vi.fn();
const deleteTenant = vi.fn();
vi.mock("@/lib/db", () => ({
  listTenantBlobRefs,
  deleteTenant,
  getTenantById: vi.fn(),
  updateTenant: vi.fn(),
}));

const deleteFromBlob = vi.fn();
vi.mock("@/lib/blob", () => ({
  deleteFromBlob,
  // Espelha produção (CDN_URL=https://cdn.autostand.com.br) — sem depender de env.
  publicUrlForKey: (key: string) => `https://cdn.autostand.com.br/${key}`,
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "1", role: "super_admin" } }),
  getApiTenantId: vi.fn(),
}));

const CDN = "https://cdn.autostand.com.br";

/** Loja 7 — a que está sendo excluída. */
const MY_PHOTO = `${CDN}/tenants/7/vehicles/12/1700000000000-abc123.jpg`;
const MY_DOC = `${CDN}/tenants/7/vehicles/12/docs/1700000000000-def456.pdf`;
const MY_LOGO = `${CDN}/tenants/7/branding/logo/1700000000000-ghi789.png`;
const MY_HERO = `${CDN}/tenants/7/branding/hero/1700000000000-jkl012.webp`;

/** Loja 99 — a vítima, que nem sabe que existe uma exclusão em curso. */
const VICTIM_LOGO = `${CDN}/tenants/99/branding/logo/1700000000000-xyz999.png`;
const VICTIM_PHOTO = `${CDN}/tenants/99/vehicles/5/1700000000000-xyz999.jpg`;

/** Hero externo (o seed usa Unsplash) — dado legítimo que não é objeto nosso. */
const EXTERNAL_HERO =
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=80";

const folders = {
  photo: "tenants/7/vehicles/12",
  doc: "tenants/7/vehicles/12/docs",
  logo: "tenants/7/branding/logo",
  hero: "tenants/7/branding/hero",
};

const ctx = () => ({ params: Promise.resolve({ id: "7" }) }) as never;
const route = () => import("@/app/api/superadmin/tenants/[id]/route");

beforeEach(() => {
  vi.clearAllMocks();
  deleteTenant.mockResolvedValue(undefined);
  deleteFromBlob.mockResolvedValue(undefined);
});

describe("DELETE /api/superadmin/tenants/[id] — prova de posse antes de apagar blob", () => {
  it("apaga os objetos que estão na pasta do próprio tenant", async () => {
    listTenantBlobRefs.mockResolvedValue([
      { url: MY_PHOTO, folder: folders.photo },
      { url: MY_DOC, folder: folders.doc },
      { url: MY_LOGO, folder: folders.logo },
      { url: MY_HERO, folder: folders.hero },
    ]);

    const { DELETE } = await route();
    const res = await DELETE({} as never, ctx());

    expect(res.status).toBe(200);
    expect(deleteTenant).toHaveBeenCalledWith(7);
    expect(deleteFromBlob).toHaveBeenCalledWith(MY_PHOTO);
    expect(deleteFromBlob).toHaveBeenCalledWith(MY_DOC);
    expect(deleteFromBlob).toHaveBeenCalledWith(MY_LOGO);
    expect(deleteFromBlob).toHaveBeenCalledWith(MY_HERO);
    expect(deleteFromBlob).toHaveBeenCalledTimes(4);
  });

  it("NÃO apaga o objeto da pasta de outro tenant (linha envenenada no banco)", async () => {
    // `logo_url` da loja 7 apontando pro logo da loja 99 — exatamente o que o
    // código vulnerável de branding permitia gravar antes de 1b04c4b.
    listTenantBlobRefs.mockResolvedValue([
      { url: VICTIM_LOGO, folder: folders.logo },
      { url: VICTIM_PHOTO, folder: folders.hero },
    ]);

    const { DELETE } = await route();
    const res = await DELETE({} as never, ctx());

    expect(res.status).toBe(200);
    expect(deleteTenant).toHaveBeenCalledWith(7);
    expect(deleteFromBlob).not.toHaveBeenCalled();
  });

  it("apaga o que é nosso e poupa o alheio no mesmo request", async () => {
    listTenantBlobRefs.mockResolvedValue([
      { url: MY_LOGO, folder: folders.logo },
      { url: VICTIM_LOGO, folder: folders.logo },
      { url: MY_PHOTO, folder: folders.photo },
      { url: VICTIM_PHOTO, folder: folders.photo },
    ]);

    const { DELETE } = await route();
    const res = await DELETE({} as never, ctx());

    expect(res.status).toBe(200);
    expect(deleteFromBlob).toHaveBeenCalledWith(MY_LOGO);
    expect(deleteFromBlob).toHaveBeenCalledWith(MY_PHOTO);
    expect(deleteFromBlob).not.toHaveBeenCalledWith(VICTIM_LOGO);
    expect(deleteFromBlob).not.toHaveBeenCalledWith(VICTIM_PHOTO);
    expect(deleteFromBlob).toHaveBeenCalledTimes(2);
  });

  it("URL externa (Unsplash do seed) não é apagada — e não é erro", async () => {
    listTenantBlobRefs.mockResolvedValue([
      { url: EXTERNAL_HERO, folder: folders.hero },
      { url: MY_LOGO, folder: folders.logo },
    ]);

    const { DELETE } = await route();
    const res = await DELETE({} as never, ctx());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(deleteFromBlob).not.toHaveBeenCalledWith(EXTERNAL_HERO);
    expect(deleteFromBlob).toHaveBeenCalledWith(MY_LOGO);
  });

  it("key da pasta certa mas fora do formato do presign também não passa", async () => {
    // Traversal e basename fora do `{timestamp}-{rand}.{ext}` — as duas coisas
    // que `assertKeyInFolder` mata, herdadas de graça pela prova de posse.
    listTenantBlobRefs.mockResolvedValue([
      { url: `${CDN}/tenants/7/branding/logo/../../99/branding/logo/x.png`, folder: folders.logo },
      { url: `${CDN}/tenants/7/branding/logo/sub/1700000000000-abc123.png`, folder: folders.logo },
      { url: `${CDN}/tenants/7/branding/logo/1700000000000-abc123.svg`, folder: folders.logo },
    ]);

    const { DELETE } = await route();
    const res = await DELETE({} as never, ctx());

    expect(res.status).toBe(200);
    expect(deleteFromBlob).not.toHaveBeenCalled();
  });

  it("tenant sem blob nenhum: apaga a loja e não chama o storage", async () => {
    listTenantBlobRefs.mockResolvedValue([]);

    const { DELETE } = await route();
    const res = await DELETE({} as never, ctx());

    expect(res.status).toBe(200);
    expect(deleteTenant).toHaveBeenCalledWith(7);
    expect(deleteFromBlob).not.toHaveBeenCalled();
  });
});
