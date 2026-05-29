import { NextResponse } from "next/server";
import { ApiError, withTenant } from "@/lib/api";
import { BANKS_BY_SLUG } from "@/lib/banks";
import { deleteFromBlob } from "@/lib/blob";
import { getTenantById, updateTenant } from "@/lib/db";
import { capabilitiesFor } from "@/lib/plans";
import { resolveLayoutConfig, sanitizeLayoutConfig } from "@/lib/layout";
import { tenantStorefrontSchema } from "@/lib/schemas";
import type { NewTenant } from "@/lib/schema";

/**
 * Personalização self-service — o `tenant_admin` atualiza a aparência do
 * próprio site. Campos da identidade (cores, hero, sobre, CTA, contato,
 * endereço, redes sociais, logo) passam por `tenantStorefrontSchema`;
 * layout (`layout_config`) só é gravado se o plano tiver a capability
 * `layoutConfig`; `partner_banks` é validado contra o catálogo mestre.
 */
export const PATCH = withTenant(async (req, { tenantId }) => {
  const tenant = await getTenantById(tenantId);
  if (!tenant) throw new ApiError("Concessionária não encontrada", 404);

  // Snapshot dos blobs atuais — pra detectar quais ficam órfãos depois do update.
  const oldLogoUrl = tenant.logo_url;
  const oldHeroUrl = resolveLayoutConfig(tenant.layout_config).heroImageUrl;

  // Lemos o body cru (não dá pra usar parseBody) pra acessar layout_config
  // + partner_banks, que ficam fora do storefrontSchema. JSON malformado
  // vira 400, não 500.
  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    throw new ApiError("Body inválido — JSON esperado.", 400);
  }
  const storefront = tenantStorefrontSchema.partial().parse(raw) as Partial<NewTenant>;
  const patch: Partial<NewTenant> = { ...storefront };

  // Layout — só planos com a capability (gating no servidor, nunca no cliente).
  if (raw.layout_config !== undefined && capabilitiesFor(tenant.plan).layoutConfig) {
    patch.layout_config = sanitizeLayoutConfig(raw.layout_config);
  }

  // Bancos parceiros — todos os planos. Filtra contra o catálogo mestre,
  // preserva ordem do envio, descarta slug desconhecido e duplicado.
  if (Array.isArray(raw.partner_banks)) {
    const seen = new Set<string>();
    const sanitized: string[] = [];
    for (const slug of raw.partner_banks) {
      if (typeof slug !== "string") continue;
      if (!BANKS_BY_SLUG[slug] || seen.has(slug)) continue;
      seen.add(slug);
      sanitized.push(slug);
    }
    patch.partner_banks = sanitized;
  }

  if (Object.keys(patch).length === 0) {
    throw new ApiError("Nada para atualizar.", 400);
  }

  const updated = await updateTenant(tenantId, patch);

  // Cleanup best-effort de blobs órfãos — se o save deu certo, qualquer
  // logo/hero substituído ou removido pode ser apagado da storage.
  // Falhas de cleanup não afetam o response.
  if (updated) {
    const newHeroUrl = resolveLayoutConfig(updated.layout_config).heroImageUrl;
    const orphans: string[] = [];
    if (oldLogoUrl && oldLogoUrl !== updated.logo_url) orphans.push(oldLogoUrl);
    if (oldHeroUrl && oldHeroUrl !== newHeroUrl) orphans.push(oldHeroUrl);
    await Promise.allSettled(orphans.map((url) => deleteFromBlob(url)));
  }

  return NextResponse.json({ ok: true, tenant: updated });
});

