import { NextResponse } from "next/server";
import { getApiTenantId } from "@/lib/auth";
import { getDashboardStats } from "@/lib/db";

export async function GET() {
  const tenantId = await getApiTenantId();
  if (tenantId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getDashboardStats(tenantId));
}
