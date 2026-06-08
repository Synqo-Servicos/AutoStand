import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn().mockResolvedValue({
  id: "sub_test_123",
  init_point: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=test",
  status: "pending",
});

vi.mock("mercadopago", () => {
  const MercadoPagoConfig = vi.fn();
  function PreApproval() { return { create: mockCreate, update: vi.fn() }; }
  return { default: MercadoPagoConfig, MercadoPagoConfig, PreApproval };
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
