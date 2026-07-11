import { describe, it, expect, vi, beforeEach } from "vitest";

const getTenantById = vi.fn();
const setTenantSubscriptionState = vi.fn();
const createTransparentSubscription = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "9", role: "super_admin" } })),
  getApiTenantId: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ getTenantById, setTenantSubscriptionState }));
vi.mock("@/lib/checkout", () => ({ createTransparentSubscription }));

function req(body: unknown) {
  return { url: "http://x/api/superadmin/fluxo-teste/pagar", json: async () => body, headers: new Headers() } as never;
}
const ctx = { params: Promise.resolve({}) } as never;
const OK = { tenantId: 7, card_token: "card_tok", payer_email: "diag@autostand.com.br" };

describe("superadmin/fluxo-teste/pagar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MERCADOPAGO_ACCESS_TOKEN = "test-token";
    getTenantById.mockResolvedValue({ id: 7, slug: "diag-abc", subscription_status: "incomplete", custom_domain: null });
    createTransparentSubscription.mockResolvedValue({ id: "sub_9", status: "authorized", statusDetail: "accredited" });
  });

  it("authorized: ativa o tenant diag- e devolve o id da assinatura", async () => {
    const { POST } = await import("@/app/api/superadmin/fluxo-teste/pagar/route");
    const res = await POST(req(OK), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "authorized", mpSubscriptionId: "sub_9" });
    expect(setTenantSubscriptionState).toHaveBeenCalledWith(7, "authorized", "sub_9");
    // usa o cupom DIAG (R$1) pelo mesmo createTransparentSubscription do cliente
    expect(createTransparentSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, slug: "diag-abc" }),
      expect.objectContaining({ slug: "basico" }),
      expect.objectContaining({ discount_type: "fixed", discount_value: 16890 }),
      "card_tok",
      "diag@autostand.com.br",
    );
  });

  it("rejected: devolve a mensagem de recusa e NÃO ativa", async () => {
    createTransparentSubscription.mockResolvedValue({
      id: null, status: "rejected", statusDetail: "cc_rejected_insufficient_amount",
      message: "Cartão sem saldo ou limite disponível. Tente outro cartão.",
    });
    const { POST } = await import("@/app/api/superadmin/fluxo-teste/pagar/route");
    const res = await POST(req(OK), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "rejected", message: /saldo|limite/i });
    expect(setTenantSubscriptionState).not.toHaveBeenCalled();
  });

  it("erro transitório do MP (throw) → 502 status:error", async () => {
    createTransparentSubscription.mockRejectedValue(new Error("timeout"));
    const { POST } = await import("@/app/api/superadmin/fluxo-teste/pagar/route");
    const res = await POST(req(OK), ctx);
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ status: "error" });
    expect(setTenantSubscriptionState).not.toHaveBeenCalled();
  });

  it("rejeita tenant que não é diag- (400) sem chamar o MP", async () => {
    getTenantById.mockResolvedValue({ id: 7, slug: "producao-real", subscription_status: "incomplete" });
    const { POST } = await import("@/app/api/superadmin/fluxo-teste/pagar/route");
    const res = await POST(req(OK), ctx);
    expect(res.status).toBe(400);
    expect(createTransparentSubscription).not.toHaveBeenCalled();
  });

  it("card_token ausente → 400", async () => {
    const { POST } = await import("@/app/api/superadmin/fluxo-teste/pagar/route");
    const res = await POST(req({ ...OK, card_token: "" }), ctx);
    expect(res.status).toBe(400);
    expect(createTransparentSubscription).not.toHaveBeenCalled();
  });

  it("sem MERCADOPAGO_ACCESS_TOKEN → 503", async () => {
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    const { POST } = await import("@/app/api/superadmin/fluxo-teste/pagar/route");
    const res = await POST(req(OK), ctx);
    expect(res.status).toBe(503);
    expect(createTransparentSubscription).not.toHaveBeenCalled();
  });
});
