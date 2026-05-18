import { NextRequest, NextResponse } from "next/server";
import { getApiTenantId } from "@/lib/auth";
import { getTenantById, getVehicleWithPhotos } from "@/lib/db";
import { capabilitiesFor } from "@/lib/plans";
import { formatBRL } from "@/lib/money";
import { FUEL_LABELS, TRANSMISSION_LABELS } from "@/lib/constants";
import type { Fuel, Transmission } from "@/lib/constants";
import { aiConfigured, gerarLegendaPost, type PostInput } from "@/lib/ai";

/**
 * Legenda do post de Instagram de um veículo — gerada por IA, plano Pro.
 */

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const tenantId = await getApiTenantId();
  if (!tenantId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const tenant = await getTenantById(tenantId);
  if (!tenant) return NextResponse.json({ error: "Concessionária não encontrada" }, { status: 404 });

  // Gating no servidor — recurso do plano Pro.
  if (!capabilitiesFor(tenant.plan).instagramPost) {
    return NextResponse.json(
      { error: "A geração de posts faz parte do plano Pro." },
      { status: 403 },
    );
  }

  if (!aiConfigured()) {
    return NextResponse.json(
      { error: "Legenda indisponível — a chave de API ainda não foi configurada." },
      { status: 503 },
    );
  }

  const { id } = await params;
  const vehicle = await getVehicleWithPhotos(tenant.id, Number(id));
  if (!vehicle) return NextResponse.json({ error: "Veículo não encontrado" }, { status: 404 });

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
    return NextResponse.json(
      { error: "Não foi possível gerar a legenda agora. Tente novamente." },
      { status: 502 },
    );
  }
}
