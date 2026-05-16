import { NextResponse } from "next/server";
import { getApiTenantId } from "@/lib/auth";
import { getTenantById, listVehicles } from "@/lib/db";
import { capabilitiesFor } from "@/lib/plans";
import { resolveLayoutConfig } from "@/lib/layout";
import { aiConfigured, analisarVitrine, type VitrineSnapshot } from "@/lib/ai";

/**
 * Análise de IA da vitrine — sob demanda, exclusiva do plano Premium (Fase 8).
 * Monta um snapshot da loja (marca, layout, catálogo) e pede recomendações.
 */
export async function POST() {
  const tenantId = await getApiTenantId();
  if (!tenantId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Concessionária não encontrada" }, { status: 404 });
  }

  // Gating no servidor — recurso do plano Premium.
  if (!capabilitiesFor(tenant.plan).aiAnalysis) {
    return NextResponse.json(
      { error: "A análise de IA faz parte do plano Premium." },
      { status: 403 },
    );
  }

  if (!aiConfigured()) {
    return NextResponse.json(
      { error: "Análise indisponível — a chave de API ainda não foi configurada." },
      { status: 503 },
    );
  }

  const vehicles = await listVehicles(tenant.id, {});
  const layout = resolveLayoutConfig(tenant.layout_config);
  const precos = vehicles.map((v) => v.sale_price);

  const snapshot: VitrineSnapshot = {
    nome: tenant.name,
    cidade: tenant.city,
    cores: { primaria: tenant.primary_color, destaque: tenant.accent_color },
    hero: {
      estilo: layout.heroStyle,
      titulo: tenant.hero_title,
      subtitulo: tenant.hero_subtitle,
      temImagem: layout.heroStyle === "image" && !!layout.heroImageUrl,
    },
    cards: { estilo: layout.cardStyle, porFila: layout.cardsPerRow },
    catalogo: {
      total: vehicles.length,
      disponiveis: vehicles.filter((v) => v.status === "disponivel").length,
      comFoto: vehicles.filter((v) => v.primary_photo_url).length,
      marcas: [...new Set(vehicles.map((v) => v.brand))],
      precoMin: precos.length ? Math.min(...precos) : null,
      precoMax: precos.length ? Math.max(...precos) : null,
    },
  };

  try {
    const analise = await analisarVitrine(snapshot);
    return NextResponse.json({ ok: true, analise });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível gerar a análise agora. Tente novamente." },
      { status: 502 },
    );
  }
}
