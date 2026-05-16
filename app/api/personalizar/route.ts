import { NextRequest, NextResponse } from "next/server";
import { getApiTenantId } from "@/lib/auth";
import { getTenantById, updateTenant } from "@/lib/db";
import { capabilitiesFor } from "@/lib/plans";
import { sanitizeLayoutConfig } from "@/lib/layout";
import type { NewTenant } from "@/lib/schema";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Personalização self-service — o `tenant_admin` atualiza a aparência do
 * próprio site. Cores e textos do hero valem para todos os planos; o layout
 * (`layout_config`) só é gravado se o plano tiver a capability `layoutConfig`.
 */
export async function PATCH(req: NextRequest) {
  const tenantId = await getApiTenantId();
  if (!tenantId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Concessionária não encontrada" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const patch: Partial<NewTenant> = {};

    // Cores da marca — todos os planos.
    for (const key of ["primary_color", "accent_color", "accent_dark_color"] as const) {
      const value = body[key];
      if (typeof value === "string") {
        if (!HEX_RE.test(value)) {
          return NextResponse.json(
            { error: "Cor inválida — use o formato #RRGGBB." },
            { status: 400 },
          );
        }
        patch[key] = value;
      }
    }

    // Textos do hero — conteúdo, todos os planos.
    if (typeof body.hero_title === "string") {
      patch.hero_title = body.hero_title.trim() || null;
    }
    if (typeof body.hero_subtitle === "string") {
      patch.hero_subtitle = body.hero_subtitle.trim() || null;
    }

    // Layout — só planos com a capability (gating no servidor, nunca no cliente).
    if (body.layout_config !== undefined && capabilitiesFor(tenant.plan).layoutConfig) {
      patch.layout_config = sanitizeLayoutConfig(body.layout_config);
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
    }

    const updated = await updateTenant(tenantId, patch);
    return NextResponse.json({ ok: true, tenant: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
