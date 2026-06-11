import type { Plan } from "@/lib/plans";
import type { CouponRow } from "@/lib/schema";

/**
 * Preço mensal (em centavos) após aplicar um cupom. Fonte ÚNICA usada tanto
 * pela prévia pública (`/api/cupons/validate`) quanto pela cobrança real no
 * Mercado Pago (`lib/checkout.ts`) — evita que o valor exibido ao usuário
 * divirja do que é efetivamente cobrado.
 *
 * - `percentage`: desconto percentual (discount_value = 10 → 10% off).
 * - `fixed`: desconto fixo em centavos (discount_value = 5000 → R$ 50 off).
 * - `free_month` (e qualquer outro): mensalidade cheia — o 1º mês grátis é um
 *   trial no MP, não reduz o valor da recorrência.
 */
export function discountedPriceCents(plan: Plan, coupon: CouponRow): number {
  const value = coupon.discount_value ?? 0;

  if (coupon.discount_type === "percentage") {
    return Math.max(0, Math.round(plan.priceMonthly * (1 - value / 100)));
  }
  if (coupon.discount_type === "fixed") {
    return Math.max(0, plan.priceMonthly - value);
  }
  return plan.priceMonthly;
}
