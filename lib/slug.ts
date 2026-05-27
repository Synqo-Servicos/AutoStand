/**
 * Slug = subdomínio do tenant em `<slug>.autostand.com.br` e identificador
 * estável. Regras: 3–32 caracteres, minúsculas, alfanumérico e hífen, sem
 * hífen nas pontas. Alguns nomes são reservados para a plataforma.
 */

export const SLUG_MIN = 3;
export const SLUG_MAX = 32;

/** Nomes que não podem virar subdomínio de tenant (colidem com a plataforma). */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "www", "app", "api", "admin", "superadmin", "console", "autostand", "auto", "stand",
  "mail", "smtp", "imap", "ftp", "cdn", "static", "assets",
  "blog", "suporte", "ajuda", "help", "status", "docs", "doc",
  "assinar", "sucesso", "login", "logout", "conta", "painel", "sistema",
  "billing", "stripe", "checkout", "pagamento", "dev", "staging", "test",
]);

const SLUG_FORMAT = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * Normaliza um texto livre (ex.: nome da concessionária) num slug-candidato:
 * minúsculas, sem acento, espaços/símbolos viram hífen, sem hífens duplicados.
 */
export function normalizeSlug(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX);
}

/** Retorna a mensagem de erro do slug, ou `null` se for válido. */
export function slugError(slug: string): string | null {
  if (slug.length < SLUG_MIN) return `O endereço precisa de pelo menos ${SLUG_MIN} caracteres.`;
  if (slug.length > SLUG_MAX) return `O endereço pode ter no máximo ${SLUG_MAX} caracteres.`;
  if (!SLUG_FORMAT.test(slug)) {
    return "Use apenas letras minúsculas, números e hífen — sem hífen no início ou fim.";
  }
  if (RESERVED_SLUGS.has(slug)) return "Este endereço é reservado. Escolha outro.";
  return null;
}

export function isValidSlug(slug: string): boolean {
  return slugError(slug) === null;
}
