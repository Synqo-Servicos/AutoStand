"use client";

import Image from "next/image";
import { useState } from "react";

type Pix = { id: string; status: string; qrCode: string; qrCodeBase64: string; ticketUrl: string };
type Flow = { tenantId: number; slug: string; checkoutUrl: string };

export function PaymentDiagnostics() {
  const [pix, setPix] = useState<Pix | null>(null);
  const [pixStatus, setPixStatus] = useState<string | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [flowStatus, setFlowStatus] = useState<string | null>(null);
  const [flowMpSubscriptionId, setFlowMpSubscriptionId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="space-y-8">
      {err && <p className="text-red-600 text-sm">{err}</p>}

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
        <h2 className="font-semibold">Fluxo completo de assinatura (R$1)</h2>
        <button
          disabled={busy}
          onClick={async () => {
            const j = await call("/api/superadmin/fluxo-teste", "POST");
            if (j) { setFlow(j); setFlowStatus(null); setFlowMpSubscriptionId(null); }
          }}
          className="rounded-md bg-ink text-white px-4 py-2 text-sm disabled:opacity-50 cursor-pointer"
        >
          Iniciar teste (R$1)
        </button>
        {flow && (
          <div className="space-y-2 text-sm">
            <p>Tenant de teste: <code>{flow.slug}</code></p>
            <a href={flow.checkoutUrl} target="_blank" rel="noreferrer" className="text-signal underline">
              Abrir checkout do MP →
            </a>
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
                  if (
                    !window.confirm(
                      "Isto cancela a assinatura REAL no Mercado Pago e apaga o tenant de teste. Confirme só depois do status aparecer como 'active'. Continuar?",
                    )
                  )
                    return;
                  const j = await call(`/api/superadmin/fluxo-teste?tenantId=${flow.tenantId}`, "DELETE");
                  if (j) { setFlow(null); setFlowStatus(null); setFlowMpSubscriptionId(null); }
                }}
                className="rounded-md border border-red-300 text-red-600 px-3 py-1.5 disabled:opacity-50 cursor-pointer"
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
