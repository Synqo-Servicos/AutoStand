import { NextResponse } from "next/server";
import { deleteLead, updateLead } from "@/lib/db";
import { ApiError, parseBody, withTenant } from "@/lib/api";
import { leadUpdateSchema } from "@/lib/schemas";

export const PATCH = withTenant<{ id: string }>(async (req, { tenantId, params }) => {
  const input = await parseBody(req, leadUpdateSchema);
  const lead = await updateLead(tenantId, Number(params.id), input);
  if (!lead) throw new ApiError("Not found", 404);
  return NextResponse.json(lead);
});

export const DELETE = withTenant<{ id: string }>(async (_req, { tenantId, params }) => {
  await deleteLead(tenantId, Number(params.id));
  return NextResponse.json({ ok: true });
});
