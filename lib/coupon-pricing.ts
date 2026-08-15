import type { Plan } from "@/lib/plans";
import type { CouponRow } from "@/lib/schema";

/**
 * Piso do valor cobrável, em centavos.
 *
 * O Mercado Pago cobra uma assinatura recorrente por `transaction_amount` — não
 * existe recorrência de valor zero. Um cupom que zera a mensalidade (100% ou
 * `fixed` >= preço do plano) portanto NÃO produz uma assinatura grátis: produz
 * a menor cobrança possível.
 *
 * O piso vive aqui, e não no momento de montar o payload do MP, porque quem
 * exibe o preço (`/api/cupons/validate`, `/api/assinar`) e quem cobra
 * (`lib/checkout.ts`) precisam ler EXATAMENTE o mesmo número. Quando o piso
 * ficava só no checkout, a jornada anunciava "R$ 0,00/mês" duas vezes e a
 * assinatura era criada a R$ 0,01/mês, para sempre.
 *
 * "1º mês grátis" de verdade é o tipo `free_month` (vira `free_trial` no MP),
 * não um cupom de 100%.
 */
export const MIN_CHARGEABLE_CENTS = 1;

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
 *
 * Nunca retorna menos que `MIN_CHARGEABLE_CENTS`: o valor devolvido é o valor
 * que será cobrado, então é ele que pode ser exibido sem mentir.
 */
export function discountedPriceCents(plan: Plan, coupon: CouponRow): number {
  const value = coupon.discount_value ?? 0;

  if (coupon.discount_type === "percentage") {
    return atLeastMinimum(Math.round(plan.priceMonthly * (1 - value / 100)));
  }
  if (coupon.discount_type === "fixed") {
    return atLeastMinimum(plan.priceMonthly - value);
  }
  return atLeastMinimum(plan.priceMonthly);
}

/**
 * Mensalidade efetivamente cobrada, com ou sem cupom. Atalho para os call sites
 * que lidam com `CouponRow | null` — mantém a conta de "quanto vamos cobrar" em
 * um lugar só.
 *
 * NOTA COMERCIAL: o parceiro (`?parceiro=`) não entra nesta conta de propósito.
 * O desconto de indicação é concedido por CUPOM (tabela `coupons`, com
 * `partner_id` apontando para o parceiro); `partners.discount_type` /
 * `partners.discount_value` são resquício do desenho antigo (era Stripe) e não
 * afetam cobrança. Ver o comentário em `lib/db/partners.ts`.
 */
export function monthlyChargeCents(plan: Plan, coupon: CouponRow | null): number {
  return coupon ? discountedPriceCents(plan, coupon) : atLeastMinimum(plan.priceMonthly);
}

function atLeastMinimum(cents: number): number {
  return Math.max(MIN_CHARGEABLE_CENTS, cents);
}
