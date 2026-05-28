import { NextResponse } from "next/server";
import { ApiError, withSuperAdmin } from "@/lib/api";
import { deleteTenant, getTenantById, updateTenant } from "@/lib/db";

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
  await deleteTenant(Number(params.id));
  return NextResponse.json({ ok: true });
});
