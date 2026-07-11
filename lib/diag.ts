import { ApiError } from "@/lib/api";
import { discountedPriceCents } from "@/lib/coupon-pricing";
import { getPlan } from "@/lib/plans";
import type { CouponRow } from "@/lib/schema";

/**
 * Helpers das rotas de diagnóstico de pagamento (superadmin). Compartilhados
 * entre `fluxo-teste` (cria o tenant diag-) e `fluxo-teste/pagar` (cobra R$1
 * via Checkout Transparente) para não duplicar o cupom sintético nem a guarda.
 */

/** Cupom sintético (NÃO persistido) que derruba o Básico p/ R$1,00 — só diag. */
export function diagCoupon(userId: number): CouponRow {
  return {
    id: -1,
    code: "DIAG",
    description: "diagnóstico",
    discount_type: "fixed",
    discount_value: 16890,
    max_uses: 1,
    used_count: 0,
    expires_at: null,
    partner_id: null,
    created_by: userId,
    created_at: "",
  } as CouponRow;
}

/** Valor cobrado no diagnóstico (Básico com o cupom DIAG), em centavos. */
export function diagAmountCents(): number {
  return discountedPriceCents(getPlan("basico"), diagCoupon(0));
}

/** Barreira de segurança: rotas de diagnóstico só operam tenants `diag-`. */
export function assertDiagTenant(tenant: { slug: string } | null): void {
  if (tenant && !tenant.slug.startsWith("diag-")) {
    throw new ApiError("Rota de diagnóstico só opera tenants diag-.", 400);
  }
}
