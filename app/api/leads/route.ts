import { NextRequest, NextResponse } from "next/server";
import { getApiTenantId } from "@/lib/auth";
import { createLead, listLeads } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";

const VALID_SOURCES = new Set(["site", "whatsapp", "manual"]);

// Admin: list this tenant's leads.
export async function GET(req: NextRequest) {
  const tenantId = await getApiTenantId();
  if (tenantId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  return NextResponse.json(
    await listLeads(tenantId, {
      status: sp.get("status") ?? undefined,
      source: sp.get("source") ?? undefined,
    }),
  );
}

// Public: a visitor submits an interest form. Tenant resolved by host.
export async function POST(req: NextRequest) {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
  }
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    if (!name || !phone) {
      return NextResponse.json({ error: "Nome e telefone são obrigatórios" }, { status: 400 });
    }
    const lead = await createLead(tenant.id, {
      name,
      phone,
      email: body.email ? String(body.email).trim() : null,
      vehicle_id: body.vehicle_id ? Number(body.vehicle_id) : null,
      message: body.message ? String(body.message) : null,
      source: VALID_SOURCES.has(body.source) ? body.source : "site",
      status: "novo",
    });
    return NextResponse.json(lead, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
