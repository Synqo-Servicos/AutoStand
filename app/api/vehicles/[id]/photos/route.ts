import { NextRequest, NextResponse } from "next/server";
import { getApiTenantId } from "@/lib/auth";
import {
  addPhoto, deletePhoto, getPhotosByVehicle, getVehicle,
  reorderVehiclePhotos, updateVehicle,
} from "@/lib/db";
import { MAX_PHOTOS_PER_VEHICLE, UploadValidationError } from "@/lib/blob-constants";
import { deleteFromBlob, publicUrlForKey } from "@/lib/blob";
import { assertKeyInFolder, uploadFolder } from "@/lib/presign";
import { ApiError, parseBody, withTenant } from "@/lib/api";
import { photoCreateSchema, photoReorderSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const tenantId = await getApiTenantId();
  if (tenantId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  return NextResponse.json(await getPhotosByVehicle(tenantId, Number(id)));
}

/**
 * Grava UMA foto já subida direto no S3 (ver /api/uploads/presign).
 *
 * Body: `{ key, set_primary? }` — JSON, não mais multipart. O arquivo não
 * passa por aqui: na Vercel o body morre em 4,5MB, na borda, e o antigo
 * fluxo mandava o lote inteiro num único POST (4 fotos já estouravam).
 * Uma foto por request, e o que trafega é só a key.
 */
export const POST = withTenant<{ id: string }>(async (req, { tenantId, params }) => {
  const vehicleId = Number(params.id);

  // Confirma que o veículo pertence ao tenant da sessão antes de aceitar
  // qualquer escrita — defesa contra um admin de loja gravar foto com FK
  // pra veículo de outra loja (mesmo que listagens depois filtrem por
  // tenant_id, isso polui o DB e abre caminho pra joins por vehicle_id).
  if (!(await getVehicle(tenantId, vehicleId))) {
    throw new ApiError("Not found", 404);
  }

  const { key, set_primary: setPrimary } = await parseBody(req, photoCreateSchema);

  // A key tem que ser uma que ESTE servidor assinou pra ESTA pasta. Sem isso
  // o admin mandaria a key de outra loja e gravaria a URL dela no próprio
  // banco — e o DELETE, que confia no banco, apagaria o blob alheio depois.
  try {
    assertKeyInFolder(key, uploadFolder("photo", tenantId, vehicleId));
  } catch (err) {
    if (err instanceof UploadValidationError) {
      throw new ApiError(err.message, err.status);
    }
    throw err;
  }

  const existing = await getPhotosByVehicle(tenantId, vehicleId);

  // Limite total — protege contra galeria infinita (gasto de storage,
  // página de veículo pesada). O presign já barra antes do upload; esta é
  // a defesa em profundidade (e cobre corrida entre uploads paralelos).
  if (existing.length >= MAX_PHOTOS_PER_VEHICLE) {
    throw new ApiError(
      `Limite de ${MAX_PHOTOS_PER_VEHICLE} fotos por veículo atingido.`,
      413,
    );
  }

  // URL derivada da key no servidor — o cliente não escolhe o que vai pro banco.
  const url = publicUrlForKey(key);
  await addPhoto(tenantId, vehicleId, url, existing.length);

  if (setPrimary) {
    await updateVehicle(tenantId, vehicleId, { primary_photo_url: url });
  }

  return NextResponse.json({ url }, { status: 201 });
});

export async function DELETE(req: NextRequest, { params }: Params) {
  const tenantId = await getApiTenantId();
  if (tenantId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const vehicleId = Number(id);

  const { url, set_primary } = await req.json();

  // Confirma que a URL é de uma foto deste tenant+veículo antes de apagar o
  // blob no S3. deletePhoto já é tenant-scoped (só apaga a linha do dono),
  // mas deleteFromBlob apaga qualquer key sob o CDN — sem esta checagem um
  // admin de loja poderia apagar a foto (URL pública) de outra loja.
  const photos = await getPhotosByVehicle(tenantId, vehicleId);
  if (!photos.some((p) => p.url === url)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteFromBlob(url);
  await deletePhoto(tenantId, url);

  if (set_primary) {
    const remaining = await getPhotosByVehicle(tenantId, vehicleId);
    await updateVehicle(tenantId, vehicleId, { primary_photo_url: remaining[0]?.url ?? null });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Reordena as fotos do veículo. Body: `{ order: [url1, url2, ...] }`
 * com as URLs na nova ordem. Cada URL precisa existir como foto do
 * mesmo (tenant, vehicleId). order_idx vira o índice no array.
 */
export const PATCH = withTenant<{ id: string }>(async (req, { tenantId, params }) => {
  const vehicleId = Number(params.id);
  if (!(await getVehicle(tenantId, vehicleId))) {
    throw new ApiError("Not found", 404);
  }
  const { order } = await parseBody(req, photoReorderSchema);
  await reorderVehiclePhotos(tenantId, vehicleId, order);
  return NextResponse.json({ ok: true });
});
