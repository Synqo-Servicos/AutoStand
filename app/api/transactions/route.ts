import { NextRequest, NextResponse } from "next/server";
import { createTransaction, listTransactions } from "@/lib/db";
import { parseBody, withTenant } from "@/lib/api";
import { transactionInputSchema } from "@/lib/schemas";

export const GET = withTenant(async (req, { tenantId }) => {
  const sp = (req as NextRequest).nextUrl.searchParams;
  const list = await listTransactions(tenantId, {
    vehicle_id: sp.get("vehicle_id") ? Number(sp.get("vehicle_id")) : undefined,
    type:       sp.get("type")       ?? undefined,
    year:       sp.get("year")       ?? undefined,
    month:      sp.get("month")      ?? undefined,
  });
  return NextResponse.json(list);
});

export const POST = withTenant(async (req, { tenantId }) => {
  // zod (transactionInputSchema.superRefine) já garante:
  //  - vehicle_id obrigatório quando type ∈ {entrada, saida, despesa_direta}
  //  - category obrigatória em despesa_direta
  const input = await parseBody(req, transactionInputSchema);
  // TransactionInput exige `T | null` (sem undefined) em todo opcional.
  const tx = await createTransaction(tenantId, {
    type: input.type,
    amount: input.amount,
    date: input.date,
    vehicle_id: input.vehicle_id ?? null,
    seller_id: input.seller_id ?? null,
    category: input.category ?? null,
    buyer_name: input.buyer_name ?? null,
    buyer_phone: input.buyer_phone ?? null,
    notes: input.notes ?? null,
  });
  return NextResponse.json(tx, { status: 201 });
});
