/**
 * Regra de comissão de venda — módulo puro, sem dependência de banco.
 *
 * Vive fora de `lib/db` porque os formulários de venda são client
 * components e não podem importar Drizzle. Antes disso, a conta existia
 * duplicada: uma vez no servidor e outra refeita à mão na UI.
 */

export interface CommissionRule {
  /** Percentual em centésimos de % — 350 = 3,5%. Null = sem percentual. */
  commission_pct: number | null;
  /** Parcela fixa, em centavos. Null = sem parcela fixa. */
  commission_fixed_cents: number | null;
}

export function computeCommission(
  saleAmountCents: number,
  seller: CommissionRule,
): number {
  const pctPart = seller.commission_pct
    ? Math.round((saleAmountCents * seller.commission_pct) / 10000)
    : 0;
  const fixedPart = seller.commission_fixed_cents ?? 0;
  return pctPart + fixedPart;
}
