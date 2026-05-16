import { NextRequest, NextResponse } from "next/server";
import { getApiTenantId } from "@/lib/auth";
import { createTransaction, listTransactions } from "@/lib/db";

export async function GET(req: NextRequest) {
  const tenantId = await getApiTenantId();
  if (tenantId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const transactions = await listTransactions(tenantId, {
    vehicle_id: sp.get("vehicle_id") ? Number(sp.get("vehicle_id")) : undefined,
    type:       sp.get("type")       ?? undefined,
    year:       sp.get("year")       ?? undefined,
    month:      sp.get("month")      ?? undefined,
  });
  return NextResponse.json(transactions);
}

export async function POST(req: NextRequest) {
  const tenantId = await getApiTenantId();
  if (tenantId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const transaction = await createTransaction(tenantId, body);
    return NextResponse.json(transaction, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
