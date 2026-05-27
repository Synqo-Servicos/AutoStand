/**
 * Constantes da plataforma — fonte única para o domínio raiz e
 * URLs derivadas. Não duplicar `process.env.PLATFORM_DOMAIN ??
 * "autostand.com.br"` em outros arquivos; importe daqui.
 */

const RAW = (process.env.PLATFORM_DOMAIN ?? "autostand.com.br").trim();

/** Domínio raiz da plataforma (ex.: `autostand.com.br`), sem protocolo. */
export const PLATFORM_DOMAIN = RAW;

/** Mesmo valor em lowercase — útil para comparação de Host header. */
export const PLATFORM_DOMAIN_LC = RAW.toLowerCase();

/** Origin canônico HTTPS (ex.: `https://autostand.com.br`). */
export const PLATFORM_ORIGIN = `https://${RAW}`;

/** Subdomínio do console super-admin (ex.: `console.autostand.com.br`). */
export const CONSOLE_HOST = `console.${RAW}`;

/** Constrói o subdomínio público de um tenant. */
export function tenantSubdomain(slug: string): string {
  return `${slug}.${RAW}`;
}
