import { NextResponse } from "next/server";
import { ApiError, withTenant } from "@/lib/api";
import { getTenantById } from "@/lib/db";
import { capabilitiesFor } from "@/lib/plans";
import { getDemandSnapshot } from "@/lib/demand";
import { aiConfigured, gerarDicasDemanda } from "@/lib/ai";

/**
 * Dicas de demanda por IA — sob demanda, exclusivo do plano Premium.
 * Monta os snapshots (marketplace + loja) e pede recomendações.
 */
export const POST = withTenant(async (_req, { tenantId }) => {
  const tenant = await getTenantById(tenantId);
  if (!tenant) throw new ApiError("Concessionária não encontrada", 404);

  if (!capabilitiesFor(tenant.plan).marketInsights) {
    throw new ApiError("A inteligência de demanda faz parte do plano Premium.", 403);
  }
  if (!aiConfigured()) {
    throw new ApiError(
      "Dicas indisponíveis — a chave de API ainda não foi configurada.",
      503,
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
    throw new ApiError("Não foi possível gerar as dicas agora. Tente novamente.", 502);
  }
});
