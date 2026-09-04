import { ApiError } from "@/lib/api";
import { discountedPriceCents } from "@/lib/coupon-pricing";
import { ENTRY_PLAN, PLANS, getPlan } from "@/lib/plans";
import type { CouponRow } from "@/lib/schema";

/**
 * Helpers das rotas de diagnóstico de pagamento (superadmin). Compartilhados
 * entre `fluxo-teste` (cria o tenant diag-) e `fluxo-teste/pagar` (cobra R$1
 * via Checkout Transparente) para não duplicar o cupom sintético nem a guarda.
 */

/** O diagnóstico cobra R$ 1,00 de um cartão real — nunca o preço de tabela. */
const DIAG_CHARGE_CENTS = 100;

/** Cupom sintético (NÃO persistido) que derruba o plano de entrada p/ R$1,00 — só diag. */
export function diagCoupon(userId: number): CouponRow {
  return {
    id: -1,
    code: "DIAG",
    description: "diagnóstico",
    discount_type: "fixed",
    // Derivado do preço VIGENTE: um valor fixo aqui vira cobrança de verdade
    // no cartão de quem rodar o diagnóstico assim que a tabela mudar.
    discount_value: PLANS[ENTRY_PLAN].priceMonthly - DIAG_CHARGE_CENTS,
    max_uses: 1,
    used_count: 0,
    expires_at: null,
    partner_id: null,
    created_by: userId,
    created_at: "",
  } as CouponRow;
}

/** Valor cobrado no diagnóstico (plano de entrada com o cupom DIAG), em centavos. */
export function diagAmountCents(): number {
  return discountedPriceCents(getPlan(ENTRY_PLAN), diagCoupon(0));
}

/** Barreira de segurança: rotas de diagnóstico só operam tenants `diag-`. */
export function assertDiagTenant(tenant: { slug: string } | null): void {
  if (tenant && !tenant.slug.startsWith("diag-")) {
    throw new ApiError("Rota de diagnóstico só opera tenants diag-.", 400);
  }
}
