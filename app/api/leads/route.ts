import { NextRequest, NextResponse } from "next/server";
import { createLead, listLeads } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { ApiError, parseBody, withTenant } from "@/lib/api";
import { publicLeadSchema } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";

// Admin: list this tenant's leads.
export const GET = withTenant(async (req, { tenantId }) => {
  const sp = (req as NextRequest).nextUrl.searchParams;
  return NextResponse.json(
    await listLeads(tenantId, {
      status: sp.get("status") ?? undefined,
      source: sp.get("source") ?? undefined,
    }),
  );
});

// Public: a visitor submits an interest form. Tenant resolved by host.
// Não usa withTenant porque o autor não tem sessão — tenant vem do host.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit("lead", ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente em alguns minutos." },
      { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined },
    );
  }

  const tenant = await getCurrentTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
  }
  try {
    const input = await parseBody(req, publicLeadSchema);
    const lead = await createLead(tenant.id, {
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      vehicle_id: input.vehicle_id ?? null,
      message: input.message ?? null,
      source: input.source ?? "site",
      status: "novo",
    });
    return NextResponse.json(lead, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
