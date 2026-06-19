import { NextResponse } from "next/server";
import { addLeadInteraction, deleteLead, getLead, updateLead } from "@/lib/db";
import { getApiUserId } from "@/lib/auth";
import { ApiError, parseBody, withTenant } from "@/lib/api";
import { leadUpdateSchema } from "@/lib/validation";

export const PATCH = withTenant<{ id: string }>(async (req, { tenantId, params }) => {
  const input = await parseBody(req, leadUpdateSchema);
  const id = Number(params.id);
  // Estado anterior só é necessário quando o status muda (para o auto-log).
  const before = input.status !== undefined ? await getLead(tenantId, id) : null;
  const lead = await updateLead(tenantId, id, input);
  if (!lead) throw new ApiError("Not found", 404);

  // Auto-log: mudança de estágio entra no histórico do lead.
  if (before && input.status && before.status !== input.status) {
    await addLeadInteraction(tenantId, id, {
      type: "mudanca_status",
      user_id: await getApiUserId(),
      metadata: { from: before.status, to: input.status },
    });
  }
  return NextResponse.json(lead);
});

export const DELETE = withTenant<{ id: string }>(async (_req, { tenantId, params }) => {
  await deleteLead(tenantId, Number(params.id));
  return NextResponse.json({ ok: true });
});
