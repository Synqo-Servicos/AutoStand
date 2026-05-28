import { NextResponse } from "next/server";
import { ApiError, withSuperAdmin } from "@/lib/api";
import { deleteFromBlob } from "@/lib/blob";
import { deleteTenant, getTenantById, listTenantBlobUrls, updateTenant } from "@/lib/db";

export const GET = withSuperAdmin<{ id: string }>(async (_req, { params }) => {
  const tenant = await getTenantById(Number(params.id));
  if (!tenant) throw new ApiError("Not found", 404);
  return NextResponse.json(tenant);
});

export const PATCH = withSuperAdmin<{ id: string }>(async (req, { params }) => {
  const body = await req.json();
  const tenant = await updateTenant(Number(params.id), body);
  if (!tenant) throw new ApiError("Not found", 404);
  return NextResponse.json(tenant);
});

export const DELETE = withSuperAdmin<{ id: string }>(async (_req, { params }) => {
  const id = Number(params.id);
  // Snapshot dos blobs ANTES do delete — depois da remoção em cascata
  // o tenant_id volta zero linhas. Cleanup é best-effort: falhas no
  // storage não revertem o delete do DB.
  const blobUrls = await listTenantBlobUrls(id);
  await deleteTenant(id);
  await Promise.allSettled(blobUrls.map((url) => deleteFromBlob(url)));
  return NextResponse.json({ ok: true });
});
