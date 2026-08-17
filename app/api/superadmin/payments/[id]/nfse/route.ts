import { NextResponse } from "next/server";
import { ApiError, parseBody } from "@/lib/api";
import { withFinanceAccess } from "@/lib/finance-access";
import { registerNfse } from "@/lib/db";
import { nfseInputSchema } from "@/lib/validation";

/**
 * Registra o número da NFS-e emitida à mão no portal para um pagamento
 * aprovado. `withFinanceAccess` (não `withSuperAdmin`) de propósito: é a
 * única gravação que o papel `contador` faz no sistema — ver
 * lib/finance-access.ts.
 */
export const POST = withFinanceAccess<{ id: string }>(async (req, { params, userId }) => {
  const paymentId = Number(params.id);
  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    throw new ApiError("id inválido", 400);
  }

  const { numero } = await parseBody(req, nfseInputSchema);

  const payment = await registerNfse(paymentId, numero, userId);
  if (!payment) throw new ApiError("Pagamento não encontrado.", 404);

  return NextResponse.json(payment);
});
