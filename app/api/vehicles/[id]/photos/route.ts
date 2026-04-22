import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { addPhoto, deletePhoto, getPhotosByVehicle, updateVehicle } from "@/lib/db";
import { uploadToBlob, deleteFromBlob } from "@/lib/blob";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json(getPhotosByVehicle(Number(id)));
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const vehicleId = Number(id);

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];
  const setPrimary = formData.get("set_primary") === "true";

  const existing = getPhotosByVehicle(vehicleId);
  const urls: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const url = await uploadToBlob(files[i], `vehicles/${vehicleId}`);
    addPhoto(vehicleId, url, existing.length + i);
    urls.push(url);
  }

  if (setPrimary && urls[0]) {
    updateVehicle(vehicleId, { primary_photo_url: urls[0] });
  }

  return NextResponse.json({ urls });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const vehicleId = Number(id);

  const { url, set_primary } = await req.json();
  await deleteFromBlob(url);
  deletePhoto(url);

  if (set_primary) {
    const remaining = getPhotosByVehicle(vehicleId);
    updateVehicle(vehicleId, { primary_photo_url: remaining[0]?.url ?? null });
  }

  return NextResponse.json({ ok: true });
}
