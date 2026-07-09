import { NextResponse } from "next/server";
import MercadoPagoConfig, { Payment } from "mercadopago";
import { ApiError, withSuperAdmin } from "@/lib/api";

const DIAG_EMAIL = "diagnostico@autostand.com.br";

function mpPayment(): Payment {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) throw new ApiError("MERCADOPAGO_ACCESS_TOKEN não configurado.", 503);
  return new Payment(new MercadoPagoConfig({ accessToken }));
}

export const POST = withSuperAdmin(async () => {
  const payment = mpPayment();
  const result = await payment.create({
    body: {
      transaction_amount: 0.01,
      description: "AutoStand — diagnóstico de pagamento",
      payment_method_id: "pix",
      payer: { email: DIAG_EMAIL },
    },
  });
  const td = result.point_of_interaction?.transaction_data;
  return NextResponse.json(
    {
      id: String(result.id),
      status: result.status,
      amount: 0.01,
      qrCode: td?.qr_code ?? "",
      qrCodeBase64: td?.qr_code_base64 ?? "",
      ticketUrl: td?.ticket_url ?? "",
    },
    { status: 201 },
  );
});

export const GET = withSuperAdmin(async (req) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) throw new ApiError("Parâmetro 'id' obrigatório.", 400);
  const result = await mpPayment().get({ id });
  return NextResponse.json({
    id: String(result.id),
    status: result.status,
    statusDetail: result.status_detail ?? null,
  });
});
