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
    process.env.MERCADOPAGO_ACCESS_TOKEN = "test-token";
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
    expect(tenantArg.status).toBe("suspended");
    expect(tenantArg.subscription_status).toBe("incomplete");

    const couponArg = createCheckoutSession.mock.calls[0][3];
    expect(couponArg).toMatchObject({ discount_type: "fixed", discount_value: 16890 });
  });

  it("GET ?tenantId devolve status da assinatura", async () => {
    getTenantById.mockResolvedValue({ slug: "diag-abc", subscription_status: "active", mp_subscription_id: "sub_1" });
    const { GET } = await import("@/app/api/superadmin/fluxo-teste/route");
    const res = await GET(req("http://x/api/superadmin/fluxo-teste?tenantId=7"), ctx);
    const json = await res.json();
    expect(json).toEqual({ subscription_status: "active", mp_subscription_id: "sub_1" });
    expect(getTenantById).toHaveBeenCalledWith(7);
  });

  it("GET rejeita tenant que não é diag- (400)", async () => {
    getTenantById.mockResolvedValue({ slug: "producao-real", subscription_status: "active", mp_subscription_id: "sub_1" });
    const { GET } = await import("@/app/api/superadmin/fluxo-teste/route");
    const res = await GET(req("http://x/api/superadmin/fluxo-teste?tenantId=7"), ctx);
    expect(res.status).toBe(400);
  });

  it("DELETE cancela assinatura (se houver) e apaga o tenant", async () => {
    getTenantById.mockResolvedValue({ id: 7, slug: "diag-abc", mp_subscription_id: "sub_1" });
    const { DELETE } = await import("@/app/api/superadmin/fluxo-teste/route");
    const res = await DELETE(req("http://x/api/superadmin/fluxo-teste?tenantId=7"), ctx);
    expect(res.status).toBe(200);
    expect(cancelMpSubscription).toHaveBeenCalledWith("sub_1");
    expect(deleteTenant).toHaveBeenCalledWith(7);
  });

  it("DELETE sem mp_subscription_id não cancela, mas apaga", async () => {
    getTenantById.mockResolvedValue({ id: 7, slug: "diag-abc", mp_subscription_id: null });
    const { DELETE } = await import("@/app/api/superadmin/fluxo-teste/route");
    await DELETE(req("http://x/api/superadmin/fluxo-teste?tenantId=7"), ctx);
    expect(cancelMpSubscription).not.toHaveBeenCalled();
    expect(deleteTenant).toHaveBeenCalledWith(7);
  });

  it("POST sem MERCADOPAGO_ACCESS_TOKEN devolve 503 e não cria tenant", async () => {
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    const { POST } = await import("@/app/api/superadmin/fluxo-teste/route");
    const res = await POST(req(), ctx);
    expect(res.status).toBe(503);
    expect(createTenant).not.toHaveBeenCalled();
  });

  it("POST faz rollback (deleteTenant) se createCheckoutSession falhar", async () => {
    createCheckoutSession.mockRejectedValue(new Error("MP fora do ar"));
    const { POST } = await import("@/app/api/superadmin/fluxo-teste/route");
    const res = await POST(req(), ctx);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(deleteTenant).toHaveBeenCalledWith(7);
  });

  it("DELETE rejeita tenant que não é diag- (400) sem cancelar/apagar", async () => {
    getTenantById.mockResolvedValue({ id: 7, slug: "producao-real", mp_subscription_id: "sub_1" });
    const { DELETE } = await import("@/app/api/superadmin/fluxo-teste/route");
    const res = await DELETE(req("http://x/api/superadmin/fluxo-teste?tenantId=7"), ctx);
    expect(res.status).toBe(400);
    expect(cancelMpSubscription).not.toHaveBeenCalled();
    expect(deleteTenant).not.toHaveBeenCalled();
  });
});
