import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do SDK do Mercado Pago. mockPlanCreate é a criação do PreApprovalPlan.
const mockPlanCreate = vi.fn();
const mockPreApprovalCreate = vi.fn();

vi.mock("mercadopago", () => {
  const MercadoPagoConfig = vi.fn();
  function PreApproval() {
    return { create: mockPreApprovalCreate, update: vi.fn() };
  }
  function PreApprovalPlan() {
    return { create: mockPlanCreate };
  }
  return { default: MercadoPagoConfig, MercadoPagoConfig, PreApproval, PreApprovalPlan };
});

const PLAN = {
  slug: "basico",
  name: "Básico",
  priceMonthly: 16990,
  mpPlanId: "plan_basico_id",
} as any;

const TENANT = { id: 1, slug: "autoprime", custom_domain: null } as any;

function makeCoupon(discount_type: string, discount_value: number | null) {
  return {
    id: 1,
    code: "TEST",
    description: null,
    discount_type,
    discount_value,
    max_uses: 1,
    used_count: 0,
    expires_at: null,
    created_by: 1,
    partner_id: null,
    created_at: "",
  } as any;
}

describe("createCheckoutSession", () => {
  beforeEach(() => {
    vi.resetModules();
    mockPlanCreate.mockReset();
    mockPlanCreate.mockResolvedValue({ id: "plan_created_123" });
    process.env.MERCADOPAGO_ACCESS_TOKEN = "test-token";
  });

  it("sem cupom: cria plano on-the-fly com mensalidade cheia e back_url da loja", async () => {
    const { createCheckoutSession } = await import("@/lib/checkout");
    const result = await createCheckoutSession(TENANT, PLAN, null);

    expect(mockPlanCreate).toHaveBeenCalledOnce();
    const body = mockPlanCreate.mock.calls[0][0].body;
    expect(body.auto_recurring.transaction_amount).toBeCloseTo(169.9, 1);
    // back_url volta pro painel da PRÓPRIA loja (subdomínio), nunca o host
    // da plataforma — senão dá 404 + sessão perdida após pagar.
    expect(body.back_url).toMatch(/^https:\/\/autoprime\..+\/admin\/assinatura$/);
    expect(result).toContain("preapproval_plan_id=plan_created_123");
    expect(result).toContain("external_reference=1");
  });

  it("cupom percentage: aplica desconto e mantém back_url da loja", async () => {
    const { createCheckoutSession } = await import("@/lib/checkout");
    const result = await createCheckoutSession(TENANT, PLAN, null, makeCoupon("percentage", 10));

    const body = mockPlanCreate.mock.calls[0][0].body;
    expect(body.reason).toContain("10%");
    expect(body.auto_recurring.transaction_amount).toBeCloseTo(152.91, 1);
    expect(body.back_url).toMatch(/^https:\/\/autoprime\..+\/admin\/assinatura$/);
    expect(result).toContain("plan_created_123");
  });

  it("cupom free_month: vira free_trial com mensalidade cheia", async () => {
    const { createCheckoutSession } = await import("@/lib/checkout");
    await createCheckoutSession(TENANT, PLAN, null, makeCoupon("free_month", null));

    const body = mockPlanCreate.mock.calls[0][0].body;
    expect(body.auto_recurring.free_trial).toEqual({ frequency: 1, frequency_type: "months" });
    expect(body.auto_recurring.transaction_amount).toBeCloseTo(169.9, 1);
  });

  it("usa custom_domain no back_url quando configurado", async () => {
    const { createCheckoutSession } = await import("@/lib/checkout");
    await createCheckoutSession(
      { id: 2, slug: "x", custom_domain: "loja.exemplo.com.br" } as any,
      PLAN,
      null,
    );

    const body = mockPlanCreate.mock.calls[0][0].body;
    expect(body.back_url).toBe("https://loja.exemplo.com.br/admin/assinatura");
  });
});

describe("createTransparentSubscription", () => {
  beforeEach(() => {
    mockPreApprovalCreate.mockReset();
    mockPreApprovalCreate.mockResolvedValue({ id: "sub_123", status: "authorized", status_detail: "accredited" });
    process.env.MERCADOPAGO_ACCESS_TOKEN = "test-token";
  });

  it("cria PreApproval com card_token, e-mail, status authorized e valor com cupom fixo", async () => {
    const { createTransparentSubscription } = await import("@/lib/checkout");
    const res = await createTransparentSubscription(TENANT, PLAN, makeCoupon("fixed", 16890), "card_tok_abc", "comprador@teste.com");
    const body = mockPreApprovalCreate.mock.calls[0][0].body;
    expect(body.card_token_id).toBe("card_tok_abc");
    expect(body.payer_email).toBe("comprador@teste.com");
    expect(body.status).toBe("authorized");
    expect(body.external_reference).toBe("1");
    expect(body.auto_recurring.transaction_amount).toBeCloseTo(1.0, 2); // 16990-16890 = 100c = R$1,00
    expect(body.back_url).toMatch(/^https:\/\/autoprime\..+\/admin\/assinatura$/);
    expect(res).toEqual({ id: "sub_123", status: "authorized", statusDetail: "accredited" });
  });

  it("free_month vira free_trial com mensalidade cheia", async () => {
    const { createTransparentSubscription } = await import("@/lib/checkout");
    await createTransparentSubscription(TENANT, PLAN, makeCoupon("free_month", null), "tok", "c@t.com");
    const body = mockPreApprovalCreate.mock.calls[0][0].body;
    expect(body.auto_recurring.free_trial).toEqual({ frequency: 1, frequency_type: "months" });
    expect(body.auto_recurring.transaction_amount).toBeCloseTo(169.9, 1);
  });
});
