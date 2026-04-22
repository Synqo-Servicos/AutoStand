export function centsToDisplay(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatBRL(cents: number): string {
  return `R$ ${centsToDisplay(cents)}`;
}

export function displayToCents(value: string): number {
  const clean = value.replace(/[R$\s.]/g, "").replace(",", ".");
  const parsed = parseFloat(clean);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}
