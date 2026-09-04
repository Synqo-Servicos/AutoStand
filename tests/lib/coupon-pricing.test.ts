import { describe, it, expect } from "vitest";
import {
  MIN_CHARGEABLE_CENTS,
  discountedPriceCents,
  monthlyChargeCents,
} from "@/lib/coupon-pricing";
import type { Plan } from "@/lib/plans";
import type { CouponRow } from "@/lib/schema";

const PLAN = { slug: "pro", name: "Pro", priceMonthly: 24990 } as unknown as Plan;

function makeCoupon(discount_type: string, discount_value: number | null): CouponRow {
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
  } as unknown as CouponRow;
}

describe("discountedPriceCents", () => {
  it("percentage: abate o percentual da mensalidade", () => {
    expect(discountedPriceCents(PLAN, makeCoupon("percentage", 10))).toBe(22491);
    expect(discountedPriceCents(PLAN, makeCoupon("percentage", 50))).toBe(12495);
  });

  it("fixed: abate o valor em centavos", () => {
    expect(discountedPriceCents(PLAN, makeCoupon("fixed", 5000))).toBe(19990);
    expect(discountedPriceCents(PLAN, makeCoupon("fixed", 24890))).toBe(100);
  });

  it("free_month (e tipo desconhecido): mensalidade cheia — o grátis é trial no MP", () => {
    expect(discountedPriceCents(PLAN, makeCoupon("free_month", null))).toBe(24990);
    expect(discountedPriceCents(PLAN, makeCoupon("tipo_novo", 999))).toBe(24990);
  });

  // --- Piso: cupom que zera o plano ---
  // Regressão: antes, 100% devolvia 0 aqui (a prévia e a tela de pagamento
  // anunciavam "R$ 0,00/mês") enquanto o checkout aplicava Math.max(1, ...) por
  // fora e criava a assinatura a R$ 0,01/mês, para sempre.

  it("percentage 100%: nunca devolve zero — devolve o mínimo cobrável", () => {
    expect(discountedPriceCents(PLAN, makeCoupon("percentage", 100))).toBe(MIN_CHARGEABLE_CENTS);
  });

  it("fixed igual ao preço do plano: devolve o mínimo cobrável", () => {
    expect(discountedPriceCents(PLAN, makeCoupon("fixed", 24990))).toBe(MIN_CHARGEABLE_CENTS);
  });

  it("fixed maior que o preço do plano: devolve o mínimo cobrável (não negativo)", () => {
    expect(discountedPriceCents(PLAN, makeCoupon("fixed", 99999))).toBe(MIN_CHARGEABLE_CENTS);
  });

  it("percentage acima de 100 também é clampado no mínimo", () => {
    expect(discountedPriceCents(PLAN, makeCoupon("percentage", 150))).toBe(MIN_CHARGEABLE_CENTS);
  });

  it("o valor devolvido é sempre positivo — é ele que vai ser cobrado e exibido", () => {
    for (const c of [
      makeCoupon("percentage", 100),
      makeCoupon("percentage", 101),
      makeCoupon("fixed", 24990),
      makeCoupon("fixed", 30000),
    ]) {
      expect(discountedPriceCents(PLAN, c)).toBeGreaterThan(0);
    }
  });
});

describe("monthlyChargeCents", () => {
  it("sem cupom: mensalidade cheia", () => {
    expect(monthlyChargeCents(PLAN, null)).toBe(24990);
  });

  it("com cupom: mesmo número de discountedPriceCents", () => {
    const coupon = makeCoupon("percentage", 10);
    expect(monthlyChargeCents(PLAN, coupon)).toBe(discountedPriceCents(PLAN, coupon));
  });

  it("cupom que zera: mínimo cobrável, nunca zero", () => {
    expect(monthlyChargeCents(PLAN, makeCoupon("percentage", 100))).toBe(MIN_CHARGEABLE_CENTS);
  });
});
