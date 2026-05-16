/**
 * Seam do Checkout — ponto de integração da Fase 2 (Stripe).
 *
 * O cadastro (`POST /api/assinar`) cria o tenant como `incomplete` e chama
 * esta função. A Fase 2 vai implementá-la para abrir uma Stripe Checkout
 * Session (assinatura, cobrança imediata da 1ª mensalidade, cupom do
 * parceiro) e devolver a URL de redirecionamento.
 *
 * Enquanto o Stripe não está ligado, retorna `null`: o cadastro conclui sem
 * cobrança e o tenant segue `incomplete` (site fora do ar) até o billing.
 */
import type { Plan } from "@/lib/plans";
import type { PartnerRow, TenantRow } from "@/lib/schema";

export async function createCheckoutSession(
  _tenant: TenantRow,
  _plan: Plan,
  _partner: PartnerRow | null,
): Promise<string | null> {
  // TODO(Fase 2 — Stripe): criar a Checkout Session e retornar `session.url`.
  return null;
}
