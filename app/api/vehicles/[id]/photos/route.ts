import { NextRequest, NextResponse } from "next/server";
import { getApiTenantId } from "@/lib/auth";
import { addPhoto, deletePhoto, getPhotosByVehicle, getVehicle, updateVehicle } from "@/lib/db";
import {
  IMAGE_MIMES, MB, UploadValidationError,
  deleteFromBlob, uploadToBlob,
} from "@/lib/blob";

const PHOTO_UPLOAD_OPTIONS = {
  allowedMimes: IMAGE_MIMES,
  maxBytes: 8 * MB,
} as const;

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const tenantId = await getApiTenantId();
  if (tenantId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  return NextResponse.json(await getPhotosByVehicle(tenantId, Number(id)));
}

export async function POST(req: NextRequest, { params }: Params) {
  const tenantId = await getApiTenantId();
  if (tenantId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const vehicleId = Number(id);

  // Confirma que o veículo pertence ao tenant da sessão antes de aceitar
  // qualquer escrita — defesa contra um admin de loja gravar foto com FK
  // pra veículo de outra loja (mesmo que listagens depois filtrem por
  // tenant_id, isso polui o DB e abre caminho pra joins por vehicle_id).
  if (!(await getVehicle(tenantId, vehicleId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];
  const setPrimary = formData.get("set_primary") === "true";

  const existing = await getPhotosByVehicle(tenantId, vehicleId);
  const urls: string[] = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const url = await uploadToBlob(
        files[i],
        `tenants/${tenantId}/vehicles/${vehicleId}`,
        PHOTO_UPLOAD_OPTIONS,
      );
      await addPhoto(tenantId, vehicleId, url, existing.length + i);
      urls.push(url);
    }
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  if (setPrimary && urls[0]) {
    await updateVehicle(tenantId, vehicleId, { primary_photo_url: urls[0] });
  }

  return NextResponse.json({ urls });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const tenantId = await getApiTenantId();
  if (tenantId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const vehicleId = Number(id);

  const { url, set_primary } = await req.json();
  await deleteFromBlob(url);
  await deletePhoto(tenantId, url);

  if (set_primary) {
    const remaining = await getPhotosByVehicle(tenantId, vehicleId);
    await updateVehicle(tenantId, vehicleId, { primary_photo_url: remaining[0]?.url ?? null });
  }

  return NextResponse.json({ ok: true });
}
