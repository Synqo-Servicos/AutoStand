import { NextResponse } from "next/server";
import { createTransaction, getPayable, hasPaymentFor } from "@/lib/db";
import { ApiError, parseBody, withTenant } from "@/lib/api";
import { payablePaymentSchema } from "@/lib/validation";
import type { TransactionType } from "@/lib/constants";

/**
 * Registra o pagamento de UM vencimento: cria uma transação normal
 * (despesa_fixa/despesa_var) carimbada com payable_id + due_date. A
 * ocorrência sai da lista de pendentes sozinha — o status é derivado.
 */
export const POST = withTenant<{ id: string }>(async (req, { tenantId, params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError("id inválido", 400);

  const input = await parseBody(req, payablePaymentSchema);

  const payable = await getPayable(tenantId, id);
  if (!payable) throw new ApiError("Conta não encontrada", 404);

  // Trava de duplicata — mesma postura da trava de venda duplicada.
  if (await hasPaymentFor(tenantId, id, input.due_date)) {
    throw new ApiError("Este vencimento já foi pago.", 409);
  }

  const tx = await createTransaction(tenantId, {
    // `payables.type` é uma coluna `text` livre no schema (espelha
    // transactions.type por convenção, não por constraint de banco) —
    // TransactionInput exige a union estrita.
    type: payable.type as TransactionType,
    category: payable.category,
    amount: input.amount,
    date: input.date,
    due_date: input.due_date,
    payable_id: id,
    payment_method: input.payment_method ?? payable.payment_method,
    notes: input.notes ?? null,
    vehicle_id: null,
    seller_id: null,
    buyer_name: null,
    buyer_phone: null,
  });

  return NextResponse.json(tx, { status: 201 });
});
