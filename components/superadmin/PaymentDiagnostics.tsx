"use client";

import Image from "next/image";
import { useState } from "react";
import { CardBrick } from "@/components/checkout/CardBrick";
import { formatBRLFull } from "@/lib/money";
import { useConfirm } from "@/components/ui";

type Pix = { id: string; status: string; qrCode: string; qrCodeBase64: string; ticketUrl: string };
type Flow = { tenantId: number; slug: string; amount: number };
type PayResult = { status: string; message?: string; mpSubscriptionId?: string };

const DIAG_EMAIL = "diag@autostand.com.br";

export function PaymentDiagnostics() {
  const [pix, setPix] = useState<Pix | null>(null);
  const [pixStatus, setPixStatus] = useState<string | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [payResult, setPayResult] = useState<PayResult | null>(null);
  const [flowStatus, setFlowStatus] = useState<string | null>(null);
  const [flowMpSubscriptionId, setFlowMpSubscriptionId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();

  async function call(url: string, method: string) {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(url, { method });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`);
      return json;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro inesperado.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleToken({ token, payerEmail }: { token: string; payerEmail: string }) {
    if (!flow) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/superadmin/fluxo-teste/pagar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: flow.tenantId,
          card_token: token,
          payer_email: payerEmail || DIAG_EMAIL,
        }),
      });
      const json = await res.json();
      if (!res.ok && !json.status) throw new Error(json.error ?? `Erro ${res.status}`);
      setPayResult(json as PayResult);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {dialog}
      {err && <p className="text-danger text-sm">{err}</p>}

      <section className="rounded-lg border border-n200 p-5 space-y-3">
        <h2 className="font-semibold">PIX rápido (credenciais + dinheiro)</h2>
        <button
          disabled={busy}
          onClick={async () => {
            const j = await call("/api/superadmin/pix-teste", "POST");
            if (j) { setPix(j); setPixStatus(j.status); }
          }}
          className="rounded-md bg-ink text-white px-4 py-2 text-sm disabled:opacity-50 cursor-pointer"
        >
          Gerar PIX de teste (R$0,01)
        </button>
        {pix && (
          <div className="space-y-2 text-sm">
            {pix.qrCodeBase64 && (
              <Image
                alt="QR do PIX"
                src={`data:image/png;base64,${pix.qrCodeBase64}`}
                width={160}
                height={160}
                unoptimized
                className="w-40 h-40"
              />
            )}
            <label className="block">Copia-e-cola:</label>
            <textarea readOnly value={pix.qrCode} className="w-full border border-n200 rounded p-2 text-xs" rows={3} />
            <button
              onClick={() => navigator.clipboard.writeText(pix.qrCode)}
              className="text-signal underline cursor-pointer"
            >
              Copiar
            </button>
            <p>Payment id: <code>{pix.id}</code></p>
            <button
              disabled={busy}
              onClick={async () => {
                const j = await call(`/api/superadmin/pix-teste?id=${pix.id}`, "GET");
                if (j) setPixStatus(j.status);
              }}
              className="rounded-md border border-n300 px-3 py-1.5 disabled:opacity-50 cursor-pointer"
            >
              Atualizar status
            </button>
            <p>Status: <strong>{pixStatus}</strong></p>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-n200 p-5 space-y-3">
        <h2 className="font-semibold">Fluxo completo de assinatura (R$1) — transparente</h2>
        <p className="text-xs text-n600">
          Mesmo Card Brick do cliente. Cobra R$1 real no cartão. Para testar recusa→retry, gere um novo teste a cada tentativa.
        </p>
        <button
          disabled={busy}
          onClick={async () => {
            const j = await call("/api/superadmin/fluxo-teste", "POST");
            if (j) { setFlow(j); setPayResult(null); setFlowStatus(null); setFlowMpSubscriptionId(null); }
          }}
          className="rounded-md bg-ink text-white px-4 py-2 text-sm disabled:opacity-50 cursor-pointer"
        >
          Iniciar teste (R$1)
        </button>
        {flow && (
          <div className="space-y-3 text-sm">
            <p>Tenant de teste: <code>{flow.slug}</code> — {formatBRLFull(flow.amount)}</p>

            {!payResult || payResult.status === "rejected" || payResult.status === "error" ? (
              <div aria-busy={busy}>
                <CardBrick
                  amountReais={flow.amount / 100}
                  payerEmail={DIAG_EMAIL}
                  onToken={handleToken}
                  onError={() => setErr("Erro ao validar o cartão. Confira os dados.")}
                />
              </div>
            ) : null}

            {payResult && (
              <p>
                Pagamento: <strong>{payResult.status}</strong>
                {payResult.message ? ` — ${payResult.message}` : ""}
                {payResult.mpSubscriptionId ? ` (${payResult.mpSubscriptionId})` : ""}
              </p>
            )}

            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={async () => {
                  const j = await call(`/api/superadmin/fluxo-teste?tenantId=${flow.tenantId}`, "GET");
                  if (j) {
                    setFlowStatus(j.subscription_status ?? "—");
                    setFlowMpSubscriptionId(j.mp_subscription_id ?? null);
                  }
                }}
                className="rounded-md border border-n300 px-3 py-1.5 disabled:opacity-50 cursor-pointer"
              >
                Atualizar status
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  const ok = await confirm({
                    title: "Cancelar e apagar o teste?",
                    description:
                      "Isto cancela a assinatura REAL no Mercado Pago e apaga o tenant de teste. Faça só depois do status aparecer como 'active'.",
                    confirmLabel: "Cancelar assinatura",
                    danger: true,
                  });
                  if (!ok) return;
                  const j = await call(`/api/superadmin/fluxo-teste?tenantId=${flow.tenantId}`, "DELETE");
                  if (j) { setFlow(null); setPayResult(null); setFlowStatus(null); setFlowMpSubscriptionId(null); }
                }}
                className="rounded-md border border-danger/30 text-danger px-3 py-1.5 disabled:opacity-50 cursor-pointer"
              >
                Limpar (cancelar + apagar tenant)
              </button>
            </div>
            <p>Status do tenant: <strong>{flowStatus ?? "—"}</strong></p>
            <p>Assinatura MP: <strong>{flowMpSubscriptionId ?? "—"}</strong></p>
          </div>
        )}
      </section>
    </div>
  );
}
