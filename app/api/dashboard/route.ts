import { NextResponse } from "next/server";
import { withTenant } from "@/lib/api";
import { getDashboardStats } from "@/lib/db";

export const GET = withTenant(async (_req, { tenantId }) => {
  return NextResponse.json(await getDashboardStats(tenantId));
});
