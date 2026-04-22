import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getVehicleWithPhotos, updateVehicle, deleteVehicle } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const vehicle = getVehicleWithPhotos(Number(id));
  if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(vehicle);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    const vehicle = updateVehicle(Number(id), body);
    return NextResponse.json(vehicle);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  deleteVehicle(Number(id));
  return NextResponse.json({ ok: true });
}
