import { NextRequest, NextResponse } from "next/server";
import { getApiTenantId } from "@/lib/auth";
import { createSeller, listSellers } from "@/lib/db";

export async function GET() {
  const tenantId = await getApiTenantId();
  if (tenantId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await listSellers(tenantId);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const tenantId = await getApiTenantId();
  if (tenantId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }
    const seller = await createSeller(tenantId, {
      name: body.name,
      phone: body.phone ?? null,
      email: body.email ?? null,
      document: body.document ?? null,
      photo_url: body.photo_url ?? null,
      commission_pct: body.commission_pct ?? null,
      commission_fixed_cents: body.commission_fixed_cents ?? null,
      status: body.status ?? "ativo",
    });
    return NextResponse.json(seller, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
