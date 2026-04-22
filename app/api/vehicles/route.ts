import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listVehicles, createVehicle } from "@/lib/db";
import type { VehicleFilters } from "@/lib/db";

export async function GET(req: NextRequest) {
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
  return NextResponse.json(listVehicles(filters));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const vehicle = createVehicle(body);
    return NextResponse.json(vehicle, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
