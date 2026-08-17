/**
 * Formato aceito de competência: `YYYY-MM`, mês entre 01 e 12 — o único
 * formato que `periodBounds` (lib/db/payments.ts) entende.
 *
 * `periodBounds` faz `Date.UTC(y, m - 1, 1).toISOString()` sem validar nada:
 * um valor não numérico (`"abc"`) vira `Date.UTC(NaN, ...)` →
 * `Invalid time value` (RangeError, derruba a página com 500); um mês fora
 * de 01–12 (`"2026-13"`) não estoura — `Date.UTC` rola silenciosamente pro
 * mês seguinte/anterior, e o período calculado fica errado sem avisar
 * ninguém. Validar aqui, antes de chegar em `periodBounds`, evita as duas
 * coisas.
 */
const COMPETENCIA_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidCompetencia(value: string): boolean {
  return COMPETENCIA_RE.test(value);
}

/**
 * Normaliza um valor vindo de fora (searchParams, querystring digitada à
 * mão, histórico do navegador) para uma competência válida. Entrada
 * ausente ou fora do formato cai no `fallback` — nunca em erro (500) e
 * nunca num período calculado silenciosamente errado.
 *
 * Quem chama decide o fallback (tipicamente o mês corrente) — esta função
 * não sabe de fuso horário.
 */
export function normalizeCompetencia(
  raw: string | undefined | null,
  fallback: string,
): string {
  return raw && isValidCompetencia(raw) ? raw : fallback;
}
