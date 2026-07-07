import { describe, it, expect, vi, beforeEach } from "vitest";

const createTenant = vi.fn();
const createUser = vi.fn();
const getTenantBySlug = vi.fn();
const getUserByEmail = vi.fn();
const getCouponByCode = vi.fn();
const getPartnerByCode = vi.fn();
const incrementCouponUse = vi.fn();
const incrementPartnerSignup = vi.fn();
const createCheckoutSession = vi.fn();
const signPaymentToken = vi.fn();
const verifyTurnstile = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { transaction: async (fn: (tx: unknown) => unknown) => fn({}) },
  createTenant, createUser, getTenantBySlug, getUserByEmail,
  getCouponByCode, getPartnerByCode, incrementCouponUse, incrementPartnerSignup,
}));
vi.mock("@/lib/checkout", () => ({ createCheckoutSession }));
vi.mock("@/lib/payment-token", () => ({ signPaymentToken }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile }));
vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: vi.fn(async () => ({ ok: true })),
  getClientIp: vi.fn(() => "1.2.3.4"),
}));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn(async () => "hashed") } }));

function req(body: unknown) {
  return { json: async () => body, headers: new Headers() } as never;
}

const VALID = {
  plan: "basico", slug: "minhaloja", dealership_name: "Minha Loja",
  admin_name: "João", admin_email: "joao@loja.com", admin_password: "senha1234",
  partner_code: "", coupon_code: null, turnstile_token: "tok",
};

describe("POST /api/assinar — modo de checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CHECKOUT_MODE;
    verifyTurnstile.mockResolvedValue(true);
    getTenantBySlug.mockResolvedValue(null);
    getUserByEmail.mockResolvedValue(null);
    getPartnerByCode.mockResolvedValue(null);
    createTenant.mockResolvedValue({ id: 42, slug: "minhaloja" });
    createUser.mockResolvedValue({ id: 1 });
    createCheckoutSession.mockResolvedValue("https://mp/checkout");
    signPaymentToken.mockReturnValue("signed.token");
  });

  it("modo redirect (default): devolve checkoutUrl", async () => {
    const { POST } = await import("@/app/api/assinar/route");
    const res = await POST(req(VALID));
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.checkoutUrl).toBe("https://mp/checkout");
    expect(json.paymentToken).toBeUndefined();
    expect(signPaymentToken).not.toHaveBeenCalled();
  });

  it("modo transparent: devolve paymentToken + amount, sem checkoutUrl", async () => {
    process.env.CHECKOUT_MODE = "transparent";
    const { POST } = await import("@/app/api/assinar/route");
    const res = await POST(req(VALID));
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.paymentToken).toBe("signed.token");
    expect(json.amount).toBe(16990);
    expect(json.checkoutUrl).toBeUndefined();
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(signPaymentToken).toHaveBeenCalledWith({ tenantId: 42, planSlug: "basico", couponId: null });
  });
});
