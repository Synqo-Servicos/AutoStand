import { NextRequest, NextResponse } from "next/server";
import { auth, getApiTenantId } from "@/lib/auth";
import { deleteVehicle, getVehicleWithPhotos, updateVehicle } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";

type Params = { params: Promise<{ id: string }> };

/**
 * Colunas que o público pode ver. Exclui `cost_price`, `fipe_code` e
 * `tenant_id` — campos internos que vazariam margem de lucro / dado
 * proprietário pela rota pública resolvida por host.
 */
const PUBLIC_VEHICLE_KEYS = new Set<string>([
  "id", "brand", "model", "version", "year", "year_manufacture", "km",
  "sale_price", "transmission", "fuel", "color", "doors", "body_type",
  "condition", "optionals", "armored", "single_owner", "description",
  "status", "primary_photo_url", "created_at", "updated_at", "photos",
]);

function sanitizeForPublic(vehicle: object): Record<string, unknown> {
  const src = vehicle as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(src)) {
    if (PUBLIC_VEHICLE_KEYS.has(key)) out[key] = src[key];
  }
  return out;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const tenant = await getCurrentTenant();
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = await params;
  const vehicle = await getVehicleWithPhotos(tenant.id, Number(id));
  if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Admin do próprio tenant pode ver a ficha completa (cost_price etc.);
  // qualquer outro consumidor (storefront público, marketplace, scraper)
  // recebe só as colunas públicas.
  const session = await auth().catch(() => null);
  const isOwnAdmin =
    session?.user?.role === "tenant_admin" && session.user.tenantId === tenant.id;
  return NextResponse.json(isOwnAdmin ? vehicle : sanitizeForPublic(vehicle));
}

export async function PUT(req: NextRequest, { params }: Params) {
  const tenantId = await getApiTenantId();
  if (tenantId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const body = await req.json();
    const vehicle = await updateVehicle(tenantId, Number(id), body);
    if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(vehicle);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const tenantId = await getApiTenantId();
  if (tenantId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await deleteVehicle(tenantId, Number(id));
  return NextResponse.json({ ok: true });
}
