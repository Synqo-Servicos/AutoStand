import { describe, it, expect, vi, beforeEach } from "vitest";
import { translateDecline } from "@/lib/checkout";
import { MIN_CHARGEABLE_CENTS, discountedPriceCents } from "@/lib/coupon-pricing";
import { PLATFORM_ORIGIN } from "@/lib/platform";

const WEBHOOK_URL = `${PLATFORM_ORIGIN}/api/webhooks/mercadopago`;

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
    const result = await createCheckoutSession(TENANT, PLAN);

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
    const result = await createCheckoutSession(TENANT, PLAN, makeCoupon("percentage", 10));

    const body = mockPlanCreate.mock.calls[0][0].body;
    expect(body.reason).toContain("10%");
    expect(body.auto_recurring.transaction_amount).toBeCloseTo(152.91, 1);
    expect(body.back_url).toMatch(/^https:\/\/autoprime\..+\/admin\/assinatura$/);
    expect(result).toContain("plan_created_123");
  });

  // Regressão: cupom de 100% (ou fixed >= preço) anunciava "R$ 0,00/mês" na
  // prévia e criava assinatura de R$ 0,01/mês por causa de um Math.max(1, ...)
  // que só existia no checkout. O piso agora é único e visível na prévia.
  it("cupom que zera o plano: cobra EXATAMENTE o valor que a prévia exibe", async () => {
    const { createCheckoutSession } = await import("@/lib/checkout");
    const coupon = makeCoupon("percentage", 100);
    await createCheckoutSession(TENANT, PLAN, coupon);

    const body = mockPlanCreate.mock.calls[0][0].body;
    // discountedPriceCents é a fonte da prévia (/api/cupons/validate) e do
    // `amount` que vai pra tela de pagamento. Cobrado === exibido.
    expect(body.auto_recurring.transaction_amount).toBe(discountedPriceCents(PLAN, coupon) / 100);
    expect(body.auto_recurring.transaction_amount).toBe(MIN_CHARGEABLE_CENTS / 100);
    expect(body.auto_recurring.transaction_amount).toBeGreaterThan(0);
  });

  it("cupom fixed maior que a mensalidade: mesmo piso, sem valor negativo", async () => {
    const { createCheckoutSession } = await import("@/lib/checkout");
    const coupon = makeCoupon("fixed", 99999);
    await createCheckoutSession(TENANT, PLAN, coupon);

    const body = mockPlanCreate.mock.calls[0][0].body;
    expect(body.auto_recurring.transaction_amount).toBe(discountedPriceCents(PLAN, coupon) / 100);
    expect(body.auto_recurring.transaction_amount).toBeGreaterThan(0);
  });

  it("cupom free_month: vira free_trial com mensalidade cheia", async () => {
    const { createCheckoutSession } = await import("@/lib/checkout");
    await createCheckoutSession(TENANT, PLAN, makeCoupon("free_month", null));

    const body = mockPlanCreate.mock.calls[0][0].body;
    expect(body.auto_recurring.free_trial).toEqual({ frequency: 1, frequency_type: "months" });
    expect(body.auto_recurring.transaction_amount).toBeCloseTo(169.9, 1);
  });

  it("usa custom_domain no back_url quando configurado", async () => {
    const { createCheckoutSession } = await import("@/lib/checkout");
    await createCheckoutSession(
      { id: 2, slug: "x", custom_domain: "loja.exemplo.com.br" } as any,
      PLAN,
    );

    const body = mockPlanCreate.mock.calls[0][0].body;
    expect(body.back_url).toBe("https://loja.exemplo.com.br/admin/assinatura");
  });

  it("envia notification_url explícito, apontando pro apex da plataforma", async () => {
    const { createCheckoutSession } = await import("@/lib/checkout");
    await createCheckoutSession(TENANT, PLAN);

    const body = mockPlanCreate.mock.calls[0][0].body;
    expect(body.notification_url).toBe(WEBHOOK_URL);
  });

  it("notification_url NÃO segue o custom_domain do tenant (só o back_url segue)", async () => {
    const { createCheckoutSession } = await import("@/lib/checkout");
    await createCheckoutSession(
      { id: 2, slug: "x", custom_domain: "loja.exemplo.com.br" } as any,
      PLAN,
    );

    const body = mockPlanCreate.mock.calls[0][0].body;
    // back_url = redirect do usuário → host da loja. notification_url =
    // server-to-server → apex, onde a rota existe e o secret valida.
    expect(body.back_url).toBe("https://loja.exemplo.com.br/admin/assinatura");
    expect(body.notification_url).toBe(WEBHOOK_URL);
    expect(body.notification_url).not.toContain("loja.exemplo.com.br");
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

  // Mesmo contrato no modo transparent (o que roda em produção): o valor
  // cobrado no MP tem que ser o mesmo que a tela de pagamento mostrou.
  it("cupom que zera o plano: cobra EXATAMENTE o valor que a tela exibe", async () => {
    const { createTransparentSubscription } = await import("@/lib/checkout");
    const coupon = makeCoupon("percentage", 100);
    await createTransparentSubscription(TENANT, PLAN, coupon, "tok", "c@t.com");

    const body = mockPreApprovalCreate.mock.calls[0][0].body;
    expect(body.auto_recurring.transaction_amount).toBe(discountedPriceCents(PLAN, coupon) / 100);
    expect(body.auto_recurring.transaction_amount).toBe(MIN_CHARGEABLE_CENTS / 100);
    expect(body.auto_recurring.transaction_amount).toBeGreaterThan(0);
  });

  it("cupom fixed igual à mensalidade: piso único, sem divergência com a prévia", async () => {
    const { createTransparentSubscription } = await import("@/lib/checkout");
    const coupon = makeCoupon("fixed", 16990);
    await createTransparentSubscription(TENANT, PLAN, coupon, "tok", "c@t.com");

    const body = mockPreApprovalCreate.mock.calls[0][0].body;
    expect(body.auto_recurring.transaction_amount).toBe(discountedPriceCents(PLAN, coupon) / 100);
    expect(body.auto_recurring.transaction_amount).toBeGreaterThan(0);
  });

  it("free_month vira free_trial com mensalidade cheia", async () => {
    const { createTransparentSubscription } = await import("@/lib/checkout");
    await createTransparentSubscription(TENANT, PLAN, makeCoupon("free_month", null), "tok", "c@t.com");
    const body = mockPreApprovalCreate.mock.calls[0][0].body;
    expect(body.auto_recurring.free_trial).toEqual({ frequency: 1, frequency_type: "months" });
    expect(body.auto_recurring.transaction_amount).toBeCloseTo(169.9, 1);
  });

  it("envia notification_url explícito, apontando pro apex da plataforma", async () => {
    const { createTransparentSubscription } = await import("@/lib/checkout");
    await createTransparentSubscription(TENANT, PLAN, null, "tok", "c@t.com");
    const body = mockPreApprovalCreate.mock.calls[0][0].body;
    expect(body.notification_url).toBe(WEBHOOK_URL);
  });

  it("notification_url NÃO segue o custom_domain do tenant (só o back_url segue)", async () => {
    const { createTransparentSubscription } = await import("@/lib/checkout");
    await createTransparentSubscription(
      { id: 2, slug: "x", custom_domain: "loja.exemplo.com.br" } as any,
      PLAN,
      null,
      "tok",
      "c@t.com",
    );
    const body = mockPreApprovalCreate.mock.calls[0][0].body;
    expect(body.back_url).toBe("https://loja.exemplo.com.br/admin/assinatura");
    expect(body.notification_url).toBe(WEBHOOK_URL);
    expect(body.notification_url).not.toContain("loja.exemplo.com.br");
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
