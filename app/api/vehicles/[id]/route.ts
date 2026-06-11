import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteFromBlob } from "@/lib/blob";
import {
  deleteVehicle,
  getVehicleWithPhotos,
  listVehicleBlobUrls,
  updateVehicle,
} from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { ApiError, parseBody, withTenant } from "@/lib/api";
import { vehicleUpdateSchema } from "@/lib/validation";

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
  // qualquer outro consumidor recebe só as colunas públicas.
  const session = await auth().catch(() => null);
  const isOwnAdmin =
    session?.user?.role === "tenant_admin" && session.user.tenantId === tenant.id;
  return NextResponse.json(isOwnAdmin ? vehicle : sanitizeForPublic(vehicle));
}

export const PUT = withTenant<{ id: string }>(async (req, { tenantId, params }) => {
  const input = await parseBody(req, vehicleUpdateSchema);
  const vehicle = await updateVehicle(tenantId, Number(params.id), input);
  if (!vehicle) throw new ApiError("Not found", 404);
  return NextResponse.json(vehicle);
});

export const DELETE = withTenant<{ id: string }>(async (_req, { tenantId, params }) => {
  const id = Number(params.id);
  // Snapshot dos blobs antes do cascade — fotos + documentos. Cleanup é
  // best-effort: falha no storage não reverte o delete do DB.
  const blobUrls = await listVehicleBlobUrls(tenantId, id);
  await deleteVehicle(tenantId, id);
  await Promise.allSettled(blobUrls.map((url) => deleteFromBlob(url)));
  return NextResponse.json({ ok: true });
});
