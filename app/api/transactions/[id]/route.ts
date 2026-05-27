import { NextResponse } from "next/server";
import { deleteTransaction, updateTransaction } from "@/lib/db";
import { ApiError, parseBody, withTenant } from "@/lib/api";
import { transactionUpdateSchema } from "@/lib/schemas";

export const PUT = withTenant<{ id: string }>(async (req, { tenantId, params }) => {
  const input = await parseBody(req, transactionUpdateSchema);
  const tx = await updateTransaction(tenantId, Number(params.id), input);
  if (!tx) throw new ApiError("Not found", 404);
  return NextResponse.json(tx);
});

export const DELETE = withTenant<{ id: string }>(async (_req, { tenantId, params }) => {
  await deleteTransaction(tenantId, Number(params.id));
  return NextResponse.json({ ok: true });
});
