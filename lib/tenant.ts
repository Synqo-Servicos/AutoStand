import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTenantByDomain, getTenantBySlug } from "@/lib/db";
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
const PLATFORM_DOMAIN = (process.env.PLATFORM_DOMAIN ?? "autostand.com.br").trim().toLowerCase();

export function isPlatformHost(host: string): boolean {
  return PLATFORM_HOSTS.includes(stripPort(host).toLowerCase());
}

function stripPort(host: string): string {
  return host.split(":")[0];
}

/** The bare hostname of the current request (no port). */
export async function getRequestHost(): Promise<string> {
  const h = await headers();
  return stripPort(h.get("host") ?? "");
}

/** Resolves the tenant for the current request, or null on a platform host. */
export async function getCurrentTenant(): Promise<TenantRow | null> {
  const host = await getRequestHost();
  if (!host || isPlatformHost(host)) return null;

  // Dev convenience: pedro-ivo.localhost:3000
  if (host.endsWith(".localhost")) {
    const slug = host.slice(0, -".localhost".length);
    return getTenantBySlug(slug);
  }

  // Subdomínio da plataforma: <slug>.autostand.com.br → resolve por slug.
  if (host.endsWith(`.${PLATFORM_DOMAIN}`)) {
    const slug = host.slice(0, -(PLATFORM_DOMAIN.length + 1));
    return slug ? getTenantBySlug(slug) : null;
  }

  // Qualquer outro host → domínio próprio configurado pelo tenant.
  return getTenantByDomain(host);
}

/** Like getCurrentTenant, but triggers a 404 when there is no active tenant. */
export async function requireTenant(): Promise<TenantRow> {
  const tenant = await getCurrentTenant();
  if (!tenant || tenant.status !== "active") notFound();
  return tenant;
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
