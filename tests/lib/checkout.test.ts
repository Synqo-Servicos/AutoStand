import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn().mockResolvedValue({
  id: "sub_test_123",
  init_point: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=test",
  status: "pending",
});

vi.mock("mercadopago", () => {
  const MercadoPagoConfig = vi.fn();
  function PreApproval() { return { create: mockCreate, update: vi.fn() }; }
  function PreApprovalPlan() { return { create: vi.fn() }; }
  return { default: MercadoPagoConfig, MercadoPagoConfig, PreApproval, PreApprovalPlan };
});

describe("createCheckoutSession", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.MERCADOPAGO_ACCESS_TOKEN = "test-token";
    process.env.AUTH_URL = "https://autostand.com.br";
  });

  it("retorna init_point para plano com mpPlanId", async () => {
    const { createCheckoutSession } = await import("@/lib/checkout");
    const result = await createCheckoutSession(
      { id: "tenant_1", slug: "autoprime" } as any,
      { slug: "basico", name: "Básico", mpPlanId: "plan_basico_id" } as any,
      null,
    );
    expect(result).toContain("mercadopago.com.br");
  });

  it("retorna null quando mpPlanId não está configurado", async () => {
    const { createCheckoutSession } = await import("@/lib/checkout");
    const result = await createCheckoutSession(
      { id: "tenant_1", slug: "autoprime" } as any,
      { slug: "basico", name: "Básico", mpPlanId: undefined } as any,
      null,
    );
    expect(result).toBeNull();
  });
});

describe("createCheckoutSession with coupon", () => {
  const mockPlanCreate = vi.fn().mockResolvedValue({ id: "plan_discounted_123" });

  beforeEach(() => {
    mockPlanCreate.mockClear();
    vi.resetModules();
    process.env.MERCADOPAGO_ACCESS_TOKEN = "test-token";
    vi.doMock("mercadopago", () => {
      const MercadoPagoConfig = vi.fn();
      function PreApproval() { return { create: vi.fn(), update: vi.fn() }; }
      function PreApprovalPlan() { return { create: mockPlanCreate }; }
      return { default: MercadoPagoConfig, MercadoPagoConfig, PreApproval, PreApprovalPlan };
    });
  });

  function makeCoupon(discount_type: string, discount_value: number | null) {
    return {
      id: 1, code: "TEST", description: null,
      discount_type, discount_value,
      max_uses: 1, used_count: 0, expires_at: null,
      created_by: 1, partner_id: null, created_at: "",
    } as any;
  }

  it("cria plano MP descontado e retorna URL para cupom percentage", async () => {
    const { createCheckoutSession } = await import("@/lib/checkout");
    const result = await createCheckoutSession(
      { id: 1, slug: "autoprime" } as any,
      { slug: "basico", name: "Básico", priceMonthly: 16990, mpPlanId: "plan_basico_id" } as any,
      null,
      makeCoupon("percentage", 10),
    );
    expect(mockPlanCreate).toHaveBeenCalledOnce();
    const callBody = mockPlanCreate.mock.calls[0][0].body;
    expect(callBody.reason).toContain("10%");
    expect(callBody.auto_recurring.transaction_amount).toBeCloseTo(152.91, 1);
    // back_url volta pro painel da PRÓPRIA loja (subdomínio), não pro
    // host da plataforma — senão dá 404 + sessão perdida após pagar.
    expect(callBody.back_url).toMatch(/^https:\/\/autoprime\..+\/admin\/assinatura$/);
    expect(result).toContain("plan_discounted_123");
  });

  it("cria plano com free_trial para cupom free_month", async () => {
    const { createCheckoutSession } = await import("@/lib/checkout");
    await createCheckoutSession(
      { id: 1, slug: "autoprime" } as any,
      { slug: "basico", name: "Básico", priceMonthly: 16990, mpPlanId: "plan_basico_id" } as any,
      null,
      makeCoupon("free_month", null),
    );
    const callBody = mockPlanCreate.mock.calls[0][0].body;
    expect(callBody.auto_recurring.free_trial).toEqual({ frequency: 1, frequency_type: "months" });
    expect(callBody.auto_recurring.transaction_amount).toBeCloseTo(169.90, 1);
  });

  it("retorna null quando sem mpPlanId e sem cupom", async () => {
    const { createCheckoutSession } = await import("@/lib/checkout");
    const result = await createCheckoutSession(
      { id: 1, slug: "autoprime" } as any,
      { slug: "basico", name: "Básico", mpPlanId: undefined } as any,
      null,
    );
    expect(result).toBeNull();
  });
});
