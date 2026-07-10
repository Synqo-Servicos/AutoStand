import { describe, it, expect, vi, beforeEach } from "vitest";
import { translateDecline } from "@/lib/checkout";

// Mock do SDK do Mercado Pago. mockPlanCreate é a criação do PreApprovalPlan.
const mockPlanCreate = vi.fn();
const mockPreApprovalCreate = vi.fn();
const mockPreApprovalSearch = vi.fn();

vi.mock("mercadopago", () => {
  const MercadoPagoConfig = vi.fn();
  function PreApproval() {
    return { create: mockPreApprovalCreate, search: mockPreApprovalSearch, update: vi.fn() };
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
    mockPreApprovalSearch.mockReset();
    mockPreApprovalSearch.mockResolvedValue({ results: [] });
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

  it("envia idempotency key estável sub-<tenantId> no create", async () => {
    const { createTransparentSubscription } = await import("@/lib/checkout");
    await createTransparentSubscription(TENANT, PLAN, null, "tok", "c@t.com");
    expect(mockPreApprovalCreate.mock.calls[0][0].requestOptions).toEqual({ idempotencyKey: "sub-1" });
  });

  it("reconcilia: se já existe assinatura authorized, não cria uma segunda", async () => {
    mockPreApprovalSearch.mockResolvedValue({
      results: [{ id: "sub_existing", status: "authorized", external_reference: 1 }],
    });
    const { createTransparentSubscription } = await import("@/lib/checkout");
    const res = await createTransparentSubscription(TENANT, PLAN, null, "tok", "c@t.com");
    expect(mockPreApprovalCreate).not.toHaveBeenCalled();
    expect(res).toEqual({ id: "sub_existing", status: "authorized", statusDetail: null });
  });

  it("não reconcilia assinatura de outro tenant (external_reference divergente): cria nova", async () => {
    mockPreApprovalSearch.mockResolvedValue({
      results: [{ id: "other", status: "authorized", external_reference: 999 }],
    });
    const { createTransparentSubscription } = await import("@/lib/checkout");
    await createTransparentSubscription(TENANT, PLAN, null, "tok", "c@t.com");
    expect(mockPreApprovalCreate).toHaveBeenCalledOnce();
  });

  it("ignora assinatura cancelada no reconcile e cria nova", async () => {
    mockPreApprovalSearch.mockResolvedValue({ results: [{ id: "old", status: "cancelled" }] });
    const { createTransparentSubscription } = await import("@/lib/checkout");
    await createTransparentSubscription(TENANT, PLAN, null, "tok", "c@t.com");
    expect(mockPreApprovalCreate).toHaveBeenCalledOnce();
  });

  it("traduz recusa lançada em 4xx (não re-lança)", async () => {
    mockPreApprovalCreate.mockRejectedValue({ status: 400, cause: [{ code: "cc_rejected_insufficient_amount" }] });
    const { createTransparentSubscription } = await import("@/lib/checkout");
    const res = await createTransparentSubscription(TENANT, PLAN, null, "tok", "c@t.com");
    expect(res.status).toBe("rejected");
    expect(res.id).toBeNull();
    expect(res.message).toMatch(/saldo|limite/i);
    expect(res.statusDetail).toBe("cc_rejected_insufficient_amount");
  });

  it("re-lança erro transitório (>=500) para a rota devolver 502", async () => {
    mockPreApprovalCreate.mockRejectedValue({ status: 500, message: "internal" });
    const { createTransparentSubscription } = await import("@/lib/checkout");
    await expect(
      createTransparentSubscription(TENANT, PLAN, null, "tok", "c@t.com"),
    ).rejects.toMatchObject({ status: 500 });
  });

  it("re-lança 401 (config/auth) em vez de classificar como recusa", async () => {
    mockPreApprovalSearch.mockResolvedValue({ results: [] });
    mockPreApprovalCreate.mockRejectedValue({ status: 401, message: "unauthorized" });
    const { createTransparentSubscription } = await import("@/lib/checkout");
    await expect(
      createTransparentSubscription(TENANT, PLAN, null, "tok", "c@t.com"),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("re-lança 429 (rate-limit) em vez de classificar como recusa", async () => {
    mockPreApprovalSearch.mockResolvedValue({ results: [] });
    mockPreApprovalCreate.mockRejectedValue({ status: 429, message: "too many requests" });
    const { createTransparentSubscription } = await import("@/lib/checkout");
    await expect(
      createTransparentSubscription(TENANT, PLAN, null, "tok", "c@t.com"),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("inclui message quando o MP retorna rejected (sem lançar)", async () => {
    mockPreApprovalCreate.mockResolvedValue({ id: "sub_r", status: "rejected", status_detail: "cc_rejected_bad_filled_security_code" });
    const { createTransparentSubscription } = await import("@/lib/checkout");
    const res = await createTransparentSubscription(TENANT, PLAN, null, "tok", "c@t.com");
    expect(res.status).toBe("rejected");
    expect(res.message).toMatch(/segurança|CVV/i);
  });
});

describe("translateDecline", () => {
  it("mapeia códigos conhecidos", () => {
    expect(translateDecline("cc_rejected_insufficient_amount")).toMatch(/saldo|limite/i);
    expect(translateDecline("cc_rejected_bad_filled_security_code")).toMatch(/segurança|CVV/i);
  });
  it("cai no genérico para desconhecido/null", () => {
    expect(translateDecline("algo_novo")).toMatch(/recusado/i);
    expect(translateDecline(null)).toMatch(/recusado/i);
  });
});
