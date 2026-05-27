import { NextRequest, NextResponse } from "next/server";
import { createVehicle, listVehicles, type VehicleFilters } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { parseBody, withTenant } from "@/lib/api";
import { vehicleInputSchema } from "@/lib/schemas";

export async function GET(req: NextRequest) {
  // Listagem é pública pelo storefront (resolve tenant pelo host), por isso
  // não usa o wrapper withTenant — que exige sessão.
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
  }
  const sp = req.nextUrl.searchParams;
  const filters: VehicleFilters = {
    status:       sp.get("status")       ?? undefined,
    brand:        sp.get("brand")        ?? undefined,
    fuel:         sp.get("fuel")         ?? undefined,
    transmission: sp.get("transmission") ?? undefined,
    year_min:     sp.get("year_min")  ? Number(sp.get("year_min"))  : undefined,
    year_max:     sp.get("year_max")  ? Number(sp.get("year_max"))  : undefined,
    km_max:       sp.get("km_max")    ? Number(sp.get("km_max"))    : undefined,
    price_min:    sp.get("price_min") ? Number(sp.get("price_min")) : undefined,
    price_max:    sp.get("price_max") ? Number(sp.get("price_max")) : undefined,
    search:       sp.get("search")       ?? undefined,
  };
  return NextResponse.json(await listVehicles(tenant.id, filters));
}

export const POST = withTenant(async (req, { tenantId }) => {
  const input = await parseBody(req, vehicleInputSchema);
  // VehicleInput exige `T | null` em todo campo opcional + defaults em
  // alguns; o zod devolve `T | null | undefined`. Coerce undefined → null
  // / default explícito.
  const vehicle = await createVehicle(tenantId, {
    brand: input.brand,
    model: input.model,
    version: input.version ?? null,
    year: input.year,
    year_manufacture: input.year_manufacture ?? null,
    km: input.km,
    cost_price: input.cost_price,
    sale_price: input.sale_price,
    transmission: input.transmission,
    fuel: input.fuel,
    color: input.color,
    doors: input.doors,
    body_type: input.body_type ?? null,
    condition: input.condition,
    optionals: input.optionals ?? null,
    armored: input.armored ?? false,
    single_owner: input.single_owner ?? false,
    plate: input.plate ?? null,
    fipe_code: input.fipe_code ?? null,
    description: input.description ?? null,
    status: input.status ?? "disponivel",
    primary_photo_url: input.primary_photo_url ?? null,
  });
  return NextResponse.json(vehicle, { status: 201 });
});
