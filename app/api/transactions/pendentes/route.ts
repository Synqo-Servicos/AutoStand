import { NextResponse } from "next/server";
import { listPendingSales } from "@/lib/db";
import { withTenant } from "@/lib/api";

export const GET = withTenant(async (_req, { tenantId }) => {
  const rows = await listPendingSales(tenantId);
  return NextResponse.json(rows);
});
