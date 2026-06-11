import { NextResponse } from "next/server";
import { deleteSeller, updateSeller } from "@/lib/db";
import { ApiError, parseBody, withTenant } from "@/lib/api";
import { sellerUpdateSchema } from "@/lib/validation";

export const PUT = withTenant<{ id: string }>(async (req, { tenantId, params }) => {
  const input = await parseBody(req, sellerUpdateSchema);
  const seller = await updateSeller(tenantId, Number(params.id), input);
  if (!seller) throw new ApiError("Not found", 404);
  return NextResponse.json(seller);
});

export const DELETE = withTenant<{ id: string }>(async (_req, { tenantId, params }) => {
  await deleteSeller(tenantId, Number(params.id));
  return NextResponse.json({ ok: true });
});
