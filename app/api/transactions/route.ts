import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listTransactions, createTransaction } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const transactions = listTransactions({
    vehicle_id: sp.get("vehicle_id") ? Number(sp.get("vehicle_id")) : undefined,
    type:       sp.get("type")       ?? undefined,
    year:       sp.get("year")       ?? undefined,
    month:      sp.get("month")      ?? undefined,
  });
  return NextResponse.json(transactions);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const transaction = createTransaction(body);
    return NextResponse.json(transaction, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
