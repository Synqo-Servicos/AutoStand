export function centsToDisplay(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatBRL(cents: number): string {
  return `R$ ${centsToDisplay(cents)}`;
}

/** Como formatBRL, mas sempre exibe centavos — útil em contextos de precificação. */
export function formatBRLFull(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

export function displayToCents(value: string): number {
  const clean = value.replace(/[R$\s.]/g, "").replace(",", ".");
  const parsed = parseFloat(clean);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}
