import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getApiTenantId } from "@/lib/auth";
import { BANKS_BY_SLUG } from "@/lib/banks";
import { getTenantById, updateTenant } from "@/lib/db";
import { capabilitiesFor } from "@/lib/plans";
import { sanitizeLayoutConfig } from "@/lib/layout";
import { tenantStorefrontSchema } from "@/lib/schemas";
import type { NewTenant } from "@/lib/schema";

/**
 * Personalização self-service — o `tenant_admin` atualiza a aparência do
 * próprio site. Campos da identidade (cores, hero, sobre, CTA, contato,
 * endereço, redes sociais) passam por `tenantStorefrontSchema`; layout
 * (`layout_config`) só é gravado se o plano tiver a capability `layoutConfig`;
 * `partner_banks` é validado contra o catálogo mestre.
 */
export async function PATCH(req: NextRequest) {
  const tenantId = await getApiTenantId();
  if (!tenantId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Concessionária não encontrada" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  // Campos da identidade visual + textos + contato (allowlist via zod).
  let storefront: Partial<NewTenant>;
  try {
    storefront = tenantStorefrontSchema.partial().parse(body) as Partial<NewTenant>;
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }
    throw err;
  }

  const patch: Partial<NewTenant> = { ...storefront };

  // Layout — só planos com a capability (gating no servidor, nunca no cliente).
  if (body.layout_config !== undefined && capabilitiesFor(tenant.plan).layoutConfig) {
    patch.layout_config = sanitizeLayoutConfig(body.layout_config);
  }

  // Bancos parceiros — todos os planos. Filtra contra o catálogo mestre,
  // preserva ordem do envio, descarta slug desconhecido e duplicado.
  if (Array.isArray(body.partner_banks)) {
    const seen = new Set<string>();
    const sanitized: string[] = [];
    for (const slug of body.partner_banks) {
      if (typeof slug !== "string") continue;
      if (!BANKS_BY_SLUG[slug] || seen.has(slug)) continue;
      seen.add(slug);
      sanitized.push(slug);
    }
    patch.partner_banks = sanitized;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const updated = await updateTenant(tenantId, patch);
  return NextResponse.json({ ok: true, tenant: updated });
}
