import { and, desc, eq, sql } from "drizzle-orm";
import { vehicle_documents, vehicle_photos, vehicles } from "@/lib/schema";
import type { VehicleDocumentRow, VehiclePhotoRow, VehicleRow } from "@/lib/schema";
import type { VehicleInput, VehicleWithPhotos } from "@/types/vehicle";
import { db } from "./client";

// — Vehicles (tenant-scoped) ———————————————————————————————————————

export interface VehicleFilters {
  status?: string;
  brand?: string;
  fuel?: string;
  transmission?: string;
  year_min?: number;
  year_max?: number;
  km_max?: number;
  price_min?: number;
  price_max?: number;
  search?: string;
}

export async function listVehicles(
  tenantId: number,
  filters: VehicleFilters = {},
): Promise<VehicleRow[]> {
  const conditions = [eq(vehicles.tenant_id, tenantId)];

  if (filters.status) conditions.push(eq(vehicles.status, filters.status));
  if (filters.brand) conditions.push(eq(vehicles.brand, filters.brand));
  if (filters.fuel) conditions.push(eq(vehicles.fuel, filters.fuel));
  if (filters.transmission) conditions.push(eq(vehicles.transmission, filters.transmission));
  if (filters.year_min) conditions.push(sql`${vehicles.year} >= ${filters.year_min}`);
  if (filters.year_max) conditions.push(sql`${vehicles.year} <= ${filters.year_max}`);
  if (filters.km_max) conditions.push(sql`${vehicles.km} <= ${filters.km_max}`);
  if (filters.price_min) conditions.push(sql`${vehicles.sale_price} >= ${filters.price_min}`);
  if (filters.price_max) conditions.push(sql`${vehicles.sale_price} <= ${filters.price_max}`);
  if (filters.search) {
    conditions.push(
      sql`(${vehicles.brand} LIKE ${`%${filters.search}%`} OR ${vehicles.model} LIKE ${`%${filters.search}%`})`,
    );
  }

  return db
    .select()
    .from(vehicles)
    .where(and(...conditions))
    .orderBy(desc(vehicles.created_at));
}

export async function getVehicle(tenantId: number, id: number): Promise<VehicleRow | null> {
  const [row] = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.tenant_id, tenantId), eq(vehicles.id, id)))
    .limit(1);
  return row ?? null;
}

export async function getVehicleWithPhotos(
  tenantId: number,
  id: number,
): Promise<VehicleWithPhotos | null> {
  const [vehicle, photos] = await Promise.all([
    getVehicle(tenantId, id),
    getPhotosByVehicle(tenantId, id),
  ]);
  if (!vehicle) return null;
  return { ...vehicle, photos };
}

export async function createVehicle(
  tenantId: number,
  input: VehicleInput,
): Promise<VehicleRow> {
  const [row] = await db
    .insert(vehicles)
    .values({ ...input, tenant_id: tenantId })
    .returning();
  return row;
}

const VEHICLE_UPDATE_FIELDS = [
  "brand", "model", "version", "year", "year_manufacture", "km",
  "cost_price", "sale_price", "transmission", "fuel", "color", "doors",
  "body_type", "condition", "optionals", "armored", "single_owner",
  "fipe_code", "plate", "description", "status", "primary_photo_url",
] as const;

export async function updateVehicle(
  tenantId: number,
  id: number,
  input: Partial<VehicleInput>,
): Promise<VehicleRow | null> {
  const safe: Record<string, unknown> = {};
  for (const key of VEHICLE_UPDATE_FIELDS) {
    if (key in input) safe[key] = input[key];
  }
  if (Object.keys(safe).length > 0) {
    await db
      .update(vehicles)
      .set({ ...safe, updated_at: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(vehicles.tenant_id, tenantId), eq(vehicles.id, id)));
  }
  return getVehicle(tenantId, id);
}

export async function deleteVehicle(tenantId: number, id: number): Promise<void> {
  await db
    .delete(vehicles)
    .where(and(eq(vehicles.tenant_id, tenantId), eq(vehicles.id, id)));
}

/**
 * Coleta todas as URLs de blob de um veículo — fotos + documentos.
 * Usado antes de deleteVehicle pra que o caller possa apagar os
 * arquivos no storage depois que o cascade DB sair.
 */
export async function listVehicleBlobUrls(
  tenantId: number,
  id: number,
): Promise<string[]> {
  const [photoUrls, docUrls] = await Promise.all([
    db
      .select({ url: vehicle_photos.url })
      .from(vehicle_photos)
      .where(and(eq(vehicle_photos.tenant_id, tenantId), eq(vehicle_photos.vehicle_id, id))),
    db
      .select({ url: vehicle_documents.url })
      .from(vehicle_documents)
      .where(and(eq(vehicle_documents.tenant_id, tenantId), eq(vehicle_documents.vehicle_id, id))),
  ]);
  return [...photoUrls.map((r) => r.url), ...docUrls.map((r) => r.url)];
}

// — Photos (tenant-scoped) ———————————————————————————————————————

export async function addPhoto(
  tenantId: number,
  vehicleId: number,
  url: string,
  orderIdx = 0,
): Promise<VehiclePhotoRow> {
  const [row] = await db
    .insert(vehicle_photos)
    .values({ tenant_id: tenantId, vehicle_id: vehicleId, url, order_idx: orderIdx })
    .returning();
  return row;
}

export async function deletePhoto(tenantId: number, url: string): Promise<void> {
  await db
    .delete(vehicle_photos)
    .where(and(eq(vehicle_photos.tenant_id, tenantId), eq(vehicle_photos.url, url)));
}

export async function getPhotosByVehicle(
  tenantId: number,
  vehicleId: number,
): Promise<VehiclePhotoRow[]> {
  return db
    .select()
    .from(vehicle_photos)
    .where(
      and(eq(vehicle_photos.tenant_id, tenantId), eq(vehicle_photos.vehicle_id, vehicleId)),
    )
    .orderBy(vehicle_photos.order_idx);
}

/**
 * Reordena as fotos do veículo segundo a ordem das URLs fornecida.
 * Atualiza `order_idx` em ordem (0..N-1) para cada URL na sequência;
 * fotos não-mencionadas ficam intocadas (defensivo — o caller deveria
 * passar todas, mas idempotência é segura). Roda em transação.
 */
export async function reorderVehiclePhotos(
  tenantId: number,
  vehicleId: number,
  orderedUrls: string[],
): Promise<void> {
  if (orderedUrls.length === 0) return;
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedUrls.length; i++) {
      await tx
        .update(vehicle_photos)
        .set({ order_idx: i })
        .where(
          and(
            eq(vehicle_photos.tenant_id, tenantId),
            eq(vehicle_photos.vehicle_id, vehicleId),
            eq(vehicle_photos.url, orderedUrls[i]),
          ),
        );
    }
  });
}

// — Documents (anexos internos do veículo) ———————————————————————

export async function addVehicleDocument(input: {
  tenantId: number;
  vehicleId: number;
  name: string;
  category: string;
  url: string;
  size?: number | null;
  mimeType?: string | null;
  uploadedBy?: number | null;
}): Promise<VehicleDocumentRow> {
  const [row] = await db
    .insert(vehicle_documents)
    .values({
      tenant_id: input.tenantId,
      vehicle_id: input.vehicleId,
      name: input.name,
      category: input.category,
      url: input.url,
      size: input.size ?? null,
      mime_type: input.mimeType ?? null,
      uploaded_by: input.uploadedBy ?? null,
    })
    .returning();
  return row;
}

export async function deleteVehicleDocument(
  tenantId: number,
  documentId: number,
): Promise<VehicleDocumentRow | null> {
  const [row] = await db
    .select()
    .from(vehicle_documents)
    .where(and(eq(vehicle_documents.tenant_id, tenantId), eq(vehicle_documents.id, documentId)))
    .limit(1);
  if (!row) return null;
  await db.delete(vehicle_documents).where(eq(vehicle_documents.id, documentId));
  return row;
}

export async function getDocumentsByVehicle(
  tenantId: number,
  vehicleId: number,
): Promise<VehicleDocumentRow[]> {
  return db
    .select()
    .from(vehicle_documents)
    .where(
      and(
        eq(vehicle_documents.tenant_id, tenantId),
        eq(vehicle_documents.vehicle_id, vehicleId),
      ),
    )
    .orderBy(desc(vehicle_documents.created_at));
}
