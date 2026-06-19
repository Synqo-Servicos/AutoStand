import { NextResponse } from "next/server";
import { addLeadInteraction, getLead, listLeadInteractions } from "@/lib/db";
import { getApiUserId } from "@/lib/auth";
import { ApiError, parseBody, withTenant } from "@/lib/api";
import { leadInteractionInputSchema } from "@/lib/validation";

/** Timeline de interações de um lead. */
export const GET = withTenant<{ id: string }>(async (_req, { tenantId, params }) => {
  const leadId = Number(params.id);
  if (!(await getLead(tenantId, leadId))) throw new ApiError("Not found", 404);
  return NextResponse.json(await listLeadInteractions(tenantId, leadId));
});

/** Registra uma interação manual (nota, ligação, WhatsApp, visita…). */
export const POST = withTenant<{ id: string }>(async (req, { tenantId, params }) => {
  const leadId = Number(params.id);
  if (!(await getLead(tenantId, leadId))) throw new ApiError("Not found", 404);
  const input = await parseBody(req, leadInteractionInputSchema);
  const row = await addLeadInteraction(tenantId, leadId, {
    type: input.type,
    body: input.body ?? null,
    user_id: await getApiUserId(),
  });
  return NextResponse.json(row, { status: 201 });
});
