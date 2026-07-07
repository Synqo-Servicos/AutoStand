"use client";

import { useEffect, type ComponentProps } from "react";
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react";
import { MP_PUBLIC_KEY } from "@/lib/mp-checkout";

// O pacote não reexporta os tipos de payload dos callbacks do brick (ex.:
// `ICardPaymentFormData`, `IBrickError`) no seu entrypoint público, então
// derivamos os tipos diretamente da assinatura do próprio componente —
// evita depender de paths internos do pacote e continua sem `any`.
type CardPaymentProps = ComponentProps<typeof CardPayment>;
type CardPaymentFormData = Parameters<CardPaymentProps["onSubmit"]>[0];
type CardPaymentBrickError = Parameters<NonNullable<CardPaymentProps["onError"]>>[0];

interface Props {
  amountReais: number;
  payerEmail?: string;
  onToken: (data: { token: string; payerEmail: string }) => Promise<void> | void;
  onError?: (error: unknown) => void;
}

/**
 * Card Payment Brick do Mercado Pago. Tokeniza o cartão no navegador (o PAN
 * nunca chega ao nosso backend) e entrega o card_token via onToken.
 */
export function CardBrick({ amountReais, payerEmail, onToken, onError }: Props) {
  useEffect(() => {
    if (MP_PUBLIC_KEY) initMercadoPago(MP_PUBLIC_KEY, { locale: "pt-BR" });
  }, []);

  if (!MP_PUBLIC_KEY) {
    return <p className="text-body-s text-danger">Pagamento indisponível no momento.</p>;
  }

  return (
    <CardPayment
      initialization={{ amount: amountReais, payer: payerEmail ? { email: payerEmail } : undefined }}
      onSubmit={async (formData: CardPaymentFormData) => {
        await onToken({ token: formData.token, payerEmail: formData.payer.email ?? payerEmail ?? "" });
      }}
      onError={(error: CardPaymentBrickError) => onError?.(error)}
    />
  );
}
