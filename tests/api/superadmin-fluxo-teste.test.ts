import { describe, it, expect, vi, beforeEach } from "vitest";

const createTenant = vi.fn();
const getTenantById = vi.fn();
const deleteTenant = vi.fn();
const createCheckoutSession = vi.fn();
const cancelMpSubscription = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "9", role: "super_admin" } })),
  getApiTenantId: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ createTenant, getTenantById, deleteTenant }));
vi.mock("@/lib/checkout", () => ({ createCheckoutSession, cancelMpSubscription }));

function req(url = "http://x/api/superadmin/fluxo-teste", body?: unknown) {
  return { url, json: async () => body, headers: new Headers() } as never;
}
const ctx = { params: Promise.resolve({}) } as never;

describe("superadmin/fluxo-teste", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createTenant.mockResolvedValue({ id: 7, slug: "diag-abc" });
    createCheckoutSession.mockResolvedValue("https://mp/checkout");
  });

  it("POST cria tenant diag- e checkout a R$1 (cupom fixed 16890)", async () => {
    const { POST } = await import("@/app/api/superadmin/fluxo-teste/route");
    const res = await POST(req(), ctx);
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json).toEqual({ tenantId: 7, slug: "diag-abc", checkoutUrl: "https://mp/checkout" });

    const tenantArg = createTenant.mock.calls[0][0];
    expect(tenantArg.slug).toMatch(/^diag-/);
    expect(tenantArg.name).toBe("Diagnóstico");

    const couponArg = createCheckoutSession.mock.calls[0][3];
    expect(couponArg).toMatchObject({ discount_type: "fixed", discount_value: 16890 });
  });

  it("GET ?tenantId devolve status da assinatura", async () => {
    getTenantById.mockResolvedValue({ subscription_status: "active", mp_subscription_id: "sub_1" });
    const { GET } = await import("@/app/api/superadmin/fluxo-teste/route");
    const res = await GET(req("http://x/api/superadmin/fluxo-teste?tenantId=7"), ctx);
    const json = await res.json();
    expect(json).toEqual({ subscription_status: "active", mp_subscription_id: "sub_1" });
    expect(getTenantById).toHaveBeenCalledWith(7);
  });

  it("DELETE cancela assinatura (se houver) e apaga o tenant", async () => {
    getTenantById.mockResolvedValue({ id: 7, mp_subscription_id: "sub_1" });
    const { DELETE } = await import("@/app/api/superadmin/fluxo-teste/route");
    const res = await DELETE(req("http://x/api/superadmin/fluxo-teste?tenantId=7"), ctx);
    expect(res.status).toBe(200);
    expect(cancelMpSubscription).toHaveBeenCalledWith("sub_1");
    expect(deleteTenant).toHaveBeenCalledWith(7);
  });

  it("DELETE sem mp_subscription_id não cancela, mas apaga", async () => {
    getTenantById.mockResolvedValue({ id: 7, mp_subscription_id: null });
    const { DELETE } = await import("@/app/api/superadmin/fluxo-teste/route");
    await DELETE(req("http://x/api/superadmin/fluxo-teste?tenantId=7"), ctx);
    expect(cancelMpSubscription).not.toHaveBeenCalled();
    expect(deleteTenant).toHaveBeenCalledWith(7);
  });
});
