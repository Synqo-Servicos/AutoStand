import { NextRequest, NextResponse } from "next/server";
import { getApiTenantId } from "@/lib/auth";
import { createVehicle, listVehicles, type VehicleFilters } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";

export async function GET(req: NextRequest) {
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

export async function POST(req: NextRequest) {
  const tenantId = await getApiTenantId();
  if (tenantId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const vehicle = await createVehicle(tenantId, body);
    return NextResponse.json(vehicle, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
