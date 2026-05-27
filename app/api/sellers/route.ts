import { NextResponse } from "next/server";
import { createSeller, listSellers } from "@/lib/db";
import { parseBody, withTenant } from "@/lib/api";
import { sellerInputSchema } from "@/lib/schemas";

export const GET = withTenant(async (_req, { tenantId }) => {
  const rows = await listSellers(tenantId);
  return NextResponse.json(rows);
});

export const POST = withTenant(async (req, { tenantId }) => {
  const input = await parseBody(req, sellerInputSchema);
  const seller = await createSeller(tenantId, {
    name: input.name,
    phone: input.phone ?? null,
    email: input.email ?? null,
    document: input.document ?? null,
    photo_url: input.photo_url ?? null,
    commission_pct: input.commission_pct ?? null,
    commission_fixed_cents: input.commission_fixed_cents ?? null,
    status: input.status ?? "ativo",
  });
  return NextResponse.json(seller, { status: 201 });
});
