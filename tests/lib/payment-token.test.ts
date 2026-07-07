import { describe, it, expect, beforeEach } from "vitest";

describe("payment-token", () => {
  beforeEach(() => {
    process.env.PAYMENT_TOKEN_SECRET = "test-secret";
  });

  it("assina e verifica um payload válido dentro do prazo", async () => {
    const { signPaymentToken, verifyPaymentToken } = await import("@/lib/payment-token");
    const now = 1_000_000;
    const token = signPaymentToken({ tenantId: 7, planSlug: "basico", couponId: 3 }, now);
    expect(verifyPaymentToken(token, now + 60)).toEqual({ tenantId: 7, planSlug: "basico", couponId: 3 });
  });

  it("rejeita token expirado (> 30 min)", async () => {
    const { signPaymentToken, verifyPaymentToken } = await import("@/lib/payment-token");
    const now = 1_000_000;
    const token = signPaymentToken({ tenantId: 7, planSlug: "basico", couponId: null }, now);
    expect(verifyPaymentToken(token, now + 30 * 60 + 1)).toBeNull();
  });

  it("rejeita assinatura adulterada", async () => {
    const { signPaymentToken, verifyPaymentToken } = await import("@/lib/payment-token");
    const now = 1_000_000;
    const token = signPaymentToken({ tenantId: 7, planSlug: "basico", couponId: null }, now);
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect(verifyPaymentToken(tampered, now + 1)).toBeNull();
  });

  it("rejeita formato inválido", async () => {
    const { verifyPaymentToken } = await import("@/lib/payment-token");
    expect(verifyPaymentToken("garbage", 1)).toBeNull();
    expect(verifyPaymentToken("", 1)).toBeNull();
  });
});
