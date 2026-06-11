import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { getTenantByDomain, getTenantBySlug } from "@/lib/db";
import { PLATFORM_DOMAIN_LC } from "@/lib/platform";
import type { TenantRow } from "@/lib/schema";

/**
 * Tenant resolution by `Host` header.
 *
 *  - Platform hosts (the SaaS itself) → no tenant; serves the /superadmin area.
 *  - `<slug>.localhost`               → dev convenience, resolves by slug.
 *  - Any other host                   → resolves by the tenant's custom domain.
 */

const PLATFORM_HOSTS = (process.env.PLATFORM_HOSTS ?? "localhost,127.0.0.1,app.localhost")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/** Domínio-base da plataforma — `<slug>.PLATFORM_DOMAIN` resolve o tenant por slug. */
const PLATFORM_DOMAIN = PLATFORM_DOMAIN_LC;

export function isPlatformHost(host: string): boolean {
  const bare = stripPort(host).toLowerCase();
  if (PLATFORM_HOSTS.includes(bare)) return true;
  // O subdomínio do console (console.<plataforma>) também é um host
  // de plataforma — não tem tenant, serve o painel super-admin.
  if (bare.startsWith("console.") && PLATFORM_HOSTS.includes(bare.slice("console.".length))) {
    return true;
  }
  return false;
}

function stripPort(host: string): string {
  return host.split(":")[0];
}

/** The bare hostname of the current request (no port). */
export async function getRequestHost(): Promise<string> {
  const h = await headers();
  return stripPort(h.get("host") ?? "");
}

const cachedGetTenantBySlug = unstable_cache(
  (slug: string) => getTenantBySlug(slug),
  ["tenant-slug"],
  { revalidate: 60 },
);

const cachedGetTenantByDomain = unstable_cache(
  (domain: string) => getTenantByDomain(domain),
  ["tenant-domain"],
  { revalidate: 60 },
);

/** Resolves the tenant for the current request, or null on a platform host. */
export async function getCurrentTenant(): Promise<TenantRow | null> {
  const host = await getRequestHost();
  if (!host || isPlatformHost(host)) return null;

  // Dev convenience: pedro-ivo.localhost:3000
  if (host.endsWith(".localhost")) {
    const slug = host.slice(0, -".localhost".length);
    return cachedGetTenantBySlug(slug);
  }

  // Subdomínio da plataforma: <slug>.autostand.com.br → resolve por slug.
  if (host.endsWith(`.${PLATFORM_DOMAIN}`)) {
    const slug = host.slice(0, -(PLATFORM_DOMAIN.length + 1));
    return slug ? cachedGetTenantBySlug(slug) : null;
  }

  // Qualquer outro host → domínio próprio configurado pelo tenant.
  return cachedGetTenantByDomain(host);
}

/**
 * Resolve o tenant para o painel administrativo — aceita **qualquer status**.
 * Uma loja `suspended` continua usando o /admin (decisão da Fase 6: o lojista
 * prepara a loja antes de pagar). 404 apenas quando não existe tenant no host.
 */
export async function getAdminTenant(): Promise<TenantRow> {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();
  return tenant;
}

/**
 * 404 quando a requisição NÃO está no host da plataforma. As páginas do
 * marketplace só existem em autostand.com.br — não na vitrine de um tenant.
 */
export async function requirePlatformHost(): Promise<void> {
  const host = await getRequestHost();
  if (!isPlatformHost(host)) notFound();
}

/**
 * Hosts do console super-admin. Reconhece subdomínio `console.*` em
 * cima de qualquer PLATFORM_HOST listado. Pensado para que a entrada
 * do admin da plataforma fique em `console.autostand.com.br` em vez
 * de uma URI óbvia em `autostand.com.br/superadmin/...`.
 */
export function isConsoleHost(host: string): boolean {
  const bare = stripPort(host).toLowerCase();
  if (!bare.startsWith("console.")) return false;
  const parent = bare.slice("console.".length);
  return PLATFORM_HOSTS.includes(parent);
}

/**
 * 404 quando a requisição NÃO está no host do console (console.*).
 * Garante que `/superadmin/*` só exista atrás do subdomínio dedicado —
 * `autostand.com.br/superadmin/login` deixa de responder.
 */
export async function requireConsoleHost(): Promise<void> {
  const host = await getRequestHost();
  if (!isConsoleHost(host)) notFound();
}
