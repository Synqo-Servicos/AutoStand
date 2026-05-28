import { NextResponse } from "next/server";
import { ApiError, withTenant } from "@/lib/api";
import { BANKS_BY_SLUG } from "@/lib/banks";
import { getTenantById, updateTenant } from "@/lib/db";
import { capabilitiesFor } from "@/lib/plans";
import { sanitizeLayoutConfig } from "@/lib/layout";
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

  // parseBody clona o request — precisamos ler o cru também pra acessar
  // layout_config + partner_banks (fora do storefrontSchema).
  const raw = (await req.json()) as Record<string, unknown>;
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
  return NextResponse.json({ ok: true, tenant: updated });
});

