export function centsToDisplay(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Como centsToDisplay, mas sempre com 2 casas decimais — pra inputs
 * editáveis de valor onde `centsToDisplay` teria arredondado pro inteiro
 * mais próximo. Contas a pagar é o primeiro domínio do app onde centavos
 * são a norma (energia, água, DAS, INSS) em vez da exceção; um campo de
 * valor que faz round-trip por `centsToDisplayFull(displayToCents(x))` no
 * onBlur preserva "137,42" em vez de virar "137".
 */
export function centsToDisplayFull(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
