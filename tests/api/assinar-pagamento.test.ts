import { describe, it, expect, vi, beforeEach } from "vitest";

const getTenantById = vi.fn();
const getCouponById = vi.fn();
const setTenantSubscriptionState = vi.fn();
const claimTenantForCheckout = vi.fn();
const releaseTenantCheckout = vi.fn();
const createTransparentSubscription = vi.fn();
const verifyPaymentToken = vi.fn();

vi.mock("@/lib/db", () => ({
  getTenantById, getCouponById, setTenantSubscriptionState,
  claimTenantForCheckout, releaseTenantCheckout,
}));
vi.mock("@/lib/checkout", () => ({ createTransparentSubscription }));
vi.mock("@/lib/payment-token", () => ({ verifyPaymentToken }));
vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: vi.fn(async () => ({ ok: true })),
  getClientIp: vi.fn(() => "1.2.3.4"),
}));

function req(body: unknown) {
  return { json: async () => body, headers: new Headers() } as never;
}

describe("POST /api/assinar/pagamento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyPaymentToken.mockReturnValue({ tenantId: 7, planSlug: "basico", couponId: null });
    getTenantById.mockResolvedValue({ id: 7, slug: "loja", subscription_status: "incomplete", custom_domain: null });
    getCouponById.mockResolvedValue(null);
    claimTenantForCheckout.mockResolvedValue(true);
    releaseTenantCheckout.mockResolvedValue(undefined);
    createTransparentSubscription.mockResolvedValue({ id: "sub_1", status: "authorized", statusDetail: "accredited" });
  });

  it("ativa o tenant quando o pagamento é authorized", async () => {
    const { POST } = await import("@/app/api/assinar/pagamento/route");
    const res = await POST(req({ paymentToken: "t", card_token: "c", payer_email: "a@b.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, slug: "loja", status: "authorized" });
    expect(setTenantSubscriptionState).toHaveBeenCalledWith(7, "authorized", "sub_1");
  });

  it("401 e não ativa quando o token é inválido/expirado", async () => {
    verifyPaymentToken.mockReturnValue(null);
    const { POST } = await import("@/app/api/assinar/pagamento/route");
    const res = await POST(req({ paymentToken: "x", card_token: "c", payer_email: "a@b.com" }));
    expect(res.status).toBe(401);
    expect(setTenantSubscriptionState).not.toHaveBeenCalled();
  });

  it("402 e não ativa quando o pagamento é rejeitado", async () => {
    createTransparentSubscription.mockResolvedValue({ id: "sub_2", status: "rejected", statusDetail: "cc_rejected_bad_filled_security_code" });
    const { POST } = await import("@/app/api/assinar/pagamento/route");
    const res = await POST(req({ paymentToken: "t", card_token: "c", payer_email: "a@b.com" }));
    expect(res.status).toBe(402);
    expect(setTenantSubscriptionState).not.toHaveBeenCalled();
  });

  it("é idempotente: tenant que já saiu de incomplete não recria assinatura", async () => {
    getTenantById.mockResolvedValue({ id: 7, slug: "loja", subscription_status: "active", custom_domain: null });
    const { POST } = await import("@/app/api/assinar/pagamento/route");
    const res = await POST(req({ paymentToken: "t", card_token: "c", payer_email: "a@b.com" }));
    expect(res.status).toBe(200);
    expect(createTransparentSubscription).not.toHaveBeenCalled();
  });

  it("não cria segunda assinatura quando perde a corrida (claim=false)", async () => {
    claimTenantForCheckout.mockResolvedValue(false);
    const { POST } = await import("@/app/api/assinar/pagamento/route");
    const res = await POST(req({ paymentToken: "t", card_token: "c", payer_email: "a@b.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, slug: "loja", status: "already_active" });
    expect(createTransparentSubscription).not.toHaveBeenCalled();
  });

  it("libera o tenant (release) quando o pagamento é recusado", async () => {
    createTransparentSubscription.mockResolvedValue({ id: "sub_2", status: "rejected", statusDetail: "cc_rejected_bad_filled_security_code" });
    const { POST } = await import("@/app/api/assinar/pagamento/route");
    const res = await POST(req({ paymentToken: "t", card_token: "c", payer_email: "a@b.com" }));
    expect(res.status).toBe(402);
    expect(releaseTenantCheckout).toHaveBeenCalledWith(7);
  });
});
