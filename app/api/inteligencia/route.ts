import { NextResponse } from "next/server";
import { getApiTenantId } from "@/lib/auth";
import { getTenantById } from "@/lib/db";
import { capabilitiesFor } from "@/lib/plans";
import { getDemandSnapshot } from "@/lib/demand";
import { aiConfigured, gerarDicasDemanda } from "@/lib/ai";

/**
 * Dicas de demanda por IA — sob demanda, exclusivo do plano Premium.
 * Monta os snapshots (marketplace + loja) e pede recomendações.
 */
export async function POST() {
  const tenantId = await getApiTenantId();
  if (!tenantId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Concessionária não encontrada" }, { status: 404 });
  }

  if (!capabilitiesFor(tenant.plan).marketInsights) {
    return NextResponse.json(
      { error: "A inteligência de demanda faz parte do plano Premium." },
      { status: 403 },
    );
  }

  if (!aiConfigured()) {
    return NextResponse.json(
      { error: "Dicas indisponíveis — a chave de API ainda não foi configurada." },
      { status: 503 },
    );
  }

  const [marketplace, loja] = await Promise.all([
    getDemandSnapshot("marketplace"),
    getDemandSnapshot({ tenantId: tenant.id }),
  ]);

  try {
    const dicas = await gerarDicasDemanda({ marketplace, loja });
    return NextResponse.json({ ok: true, dicas });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível gerar as dicas agora. Tente novamente." },
      { status: 502 },
    );
  }
}
