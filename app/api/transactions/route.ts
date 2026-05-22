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

const VEHICLE_REQUIRED = new Set(["entrada", "saida", "despesa_direta"]);

export async function POST(req: NextRequest) {
  const tenantId = await getApiTenantId();
  if (tenantId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    if (VEHICLE_REQUIRED.has(body.type) && !body.vehicle_id) {
      return NextResponse.json(
        { error: "vehicle_id é obrigatório para este tipo de transação" },
        { status: 400 },
      );
    }
    if (body.type === "despesa_direta" && !body.category) {
      return NextResponse.json(
        { error: "Categoria é obrigatória em despesa direta" },
        { status: 400 },
      );
    }
    const transaction = await createTransaction(tenantId, body);
    return NextResponse.json(transaction, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
