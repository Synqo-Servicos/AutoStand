import { NextResponse } from "next/server";
import { updatePayable } from "@/lib/db";
import { ApiError, parseBody, withTenant } from "@/lib/api";
import { payableUpdateSchema } from "@/lib/validation";

export const PATCH = withTenant<{ id: string }>(async (req, { tenantId, params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError("id inválido", 400);

  const input = await parseBody(req, payableUpdateSchema);
  const row = await updatePayable(tenantId, id, input);
  if (!row) throw new ApiError("Conta não encontrada", 404);

  return NextResponse.json(row);
});
