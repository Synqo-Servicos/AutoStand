import { NextResponse } from "next/server";
import { deleteAboutItem, updateAboutItem } from "@/lib/db";
import { ApiError, parseBody, withTenant } from "@/lib/api";
import { aboutItemUpdateSchema } from "@/lib/validation";

export const PATCH = withTenant<{ id: string }>(async (req, { tenantId, params }) => {
  const input = await parseBody(req, aboutItemUpdateSchema);
  const item = await updateAboutItem(tenantId, Number(params.id), input);
  if (!item) throw new ApiError("Not found", 404);
  return NextResponse.json(item);
});

export const DELETE = withTenant<{ id: string }>(async (_req, { tenantId, params }) => {
  await deleteAboutItem(tenantId, Number(params.id));
  return NextResponse.json({ ok: true });
});
