import { NextRequest, NextResponse } from "next/server";
import { getApiTenantId } from "@/lib/auth";
import { deleteVehicle, getVehicleWithPhotos, updateVehicle } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const tenant = await getCurrentTenant();
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = await params;
  const vehicle = await getVehicleWithPhotos(tenant.id, Number(id));
  if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(vehicle);
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
