/** Public key do Mercado Pago — inlined em build (NEXT_PUBLIC_). Vazia = checkout transparente indisponível. */
export const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY?.trim() ?? "";

export function isMpCheckoutEnabled(): boolean {
  return Boolean(MP_PUBLIC_KEY);
}
