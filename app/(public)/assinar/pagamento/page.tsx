"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CardBrick } from "@/components/checkout/CardBrick";
import { formatBRLFull } from "@/lib/money";

interface Handoff {
  paymentToken: string;
  amount: number; // centavos
  slug: string;
  email: string;
}
const KEY = "autostand.payment";

export default function PaymentPage() {
  const router = useRouter();
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) {
      router.replace("/assinar");
      return;
    }
    try {
      setHandoff(JSON.parse(raw) as Handoff);
    } catch {
      router.replace("/assinar");
    }
  }, [router]);

  if (!handoff) return null;

  async function handleToken({ token, payerEmail }: { token: string; payerEmail: string }) {
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch("/api/assinar/pagamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentToken: handoff!.paymentToken,
          card_token: token,
          payer_email: payerEmail || handoff!.email,
        }),
      });
      const data = await res.json();
      if (res.ok && (data.status === "authorized" || data.status === "already_active")) {
        sessionStorage.removeItem(KEY);
        router.push(`/assinar/sucesso?loja=${encodeURIComponent(handoff!.slug)}`);
        return;
      }
      if (res.ok && data.status === "pending") {
        sessionStorage.removeItem(KEY);
        router.push(`/assinar/sucesso?loja=${encodeURIComponent(handoff!.slug)}&pendente=1`);
        return;
      }
      setError(data.error ?? "Pagamento não aprovado. Tente outro cartão.");
      // Remonta o Card Brick para um formulário limpo (tentar outro cartão).
      setAttempt((a) => a + 1);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="font-display text-h3 text-ink">Pagamento</h1>
      <p className="mt-1 text-body-s text-n600">
        {formatBRLFull(handoff.amount)}/mês — {handoff.slug}.autostand.com.br
      </p>
      {error && (
        <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-body-s text-danger">{error}</p>
      )}
      <div className="mt-6" aria-busy={processing}>
        <CardBrick
          key={attempt}
          amountReais={handoff.amount / 100}
          payerEmail={handoff.email}
          onToken={handleToken}
          onError={() => setError("Erro ao validar o cartão. Confira os dados.")}
        />
      </div>
    </main>
  );
}
