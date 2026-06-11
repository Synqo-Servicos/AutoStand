import { NextResponse } from "next/server";
import { ApiError, withTenant } from "@/lib/api";
import { getTenantById, getVehicleWithPhotos } from "@/lib/db";
import { capabilitiesFor } from "@/lib/plans";
import { formatBRL } from "@/lib/money";
import { FUEL_LABELS, TRANSMISSION_LABELS } from "@/lib/constants";
import type { Fuel, Transmission } from "@/lib/constants";
import { aiConfigured, gerarLegendaPost, type PostInput } from "@/lib/ai";

/**
 * Legenda do post de Instagram de um veículo — gerada por IA, plano Pro.
 */
export const POST = withTenant<{ id: string }>(async (_req, { tenantId, params }) => {
  const tenant = await getTenantById(tenantId);
  if (!tenant) throw new ApiError("Concessionária não encontrada", 404);

  // Gating no servidor — recurso do plano Pro.
  if (!capabilitiesFor(tenant.plan).instagramPost) {
    throw new ApiError("A geração de posts faz parte do plano Pro.", 403);
  }
  if (!aiConfigured()) {
    throw new ApiError(
      "Legenda indisponível — a chave de API ainda não foi configurada.",
      503,
    );
  }

  const vehicle = await getVehicleWithPhotos(tenant.id, Number(params.id));
  if (!vehicle) throw new ApiError("Veículo não encontrado", 404);

  const anos =
    vehicle.year_manufacture && vehicle.year_manufacture !== vehicle.year
      ? `${vehicle.year_manufacture}/${vehicle.year}`
      : String(vehicle.year);

  const input: PostInput = {
    veiculo: {
      marca: vehicle.brand,
      modelo: vehicle.model,
      versao: vehicle.version,
      ano: anos,
      km: vehicle.km,
      cambio: TRANSMISSION_LABELS[vehicle.transmission as Transmission] ?? vehicle.transmission,
      combustivel: FUEL_LABELS[vehicle.fuel as Fuel] ?? vehicle.fuel,
      cor: vehicle.color,
      precoFormatado: formatBRL(vehicle.sale_price),
      condicao: vehicle.condition,
      carroceria: vehicle.body_type,
      opcionais: vehicle.optionals ?? [],
      blindado: vehicle.armored,
      unicoDono: vehicle.single_owner,
    },
    loja: {
      nome: tenant.name,
      cidade: tenant.city,
      whatsapp: tenant.whatsapp_number,
    },
  };

  try {
    const legenda = await gerarLegendaPost(input);
    return NextResponse.json({ ok: true, legenda });
  } catch {
    throw new ApiError("Não foi possível gerar a legenda agora. Tente novamente.", 502);
  }
});
