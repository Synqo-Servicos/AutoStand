"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import type { DicasDemanda } from "@/lib/ai";

const OPP: Record<string, { label: string; cls: string }> = {
  alta: { label: "Alta oportunidade", cls: "bg-success/15 text-ink ring-1 ring-success/40" },
  media: { label: "Oportunidade média", cls: "bg-warning/15 text-ink ring-1 ring-warning/40" },
  baixa: { label: "Baixa", cls: "bg-n100 text-n600 ring-1 ring-n200" },
};
const ORDER: Record<string, number> = { alta: 0, media: 1, baixa: 2 };

export function InteligenciaDicas({ configured }: { configured: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dicas, setDicas] = useState<DicasDemanda | null>(null);

  async function gerar() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/inteligencia", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Não foi possível gerar as dicas.");
      else setDicas(data.dicas);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
    setLoading(false);
  }

  const ordered = dicas
    ? [...dicas.dicas].sort((a, b) => ORDER[a.oportunidade] - ORDER[b.oportunidade])
    : [];

  return (
    <div className="rounded-xl border border-n200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Dicas de demanda</h2>
          <p className="text-xs text-n500">
            A IA lê os sinais abaixo e sugere ações de estoque e anúncio.
          </p>
        </div>
        <button
          onClick={gerar}
          disabled={loading || !configured}
          className="inline-flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-signal-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Gerando…" : dicas ? "Gerar de novo" : "Gerar dicas"}
        </button>
      </div>

      {!configured && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-warning/15 px-3 py-2 text-xs text-ink">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          As dicas por IA ainda não foram configuradas (chave de API ausente).
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {dicas && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-ink">{dicas.resumo}</p>
          {ordered.map((d, i) => (
            <div key={i} className="rounded-lg border border-n100 bg-n50 p-3">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${OPP[d.oportunidade]?.cls ?? ""}`}>
                  {OPP[d.oportunidade]?.label ?? d.oportunidade}
                </span>
              </div>
              <h3 className="mt-1.5 text-sm font-semibold text-ink">{d.titulo}</h3>
              <p className="mt-0.5 text-sm text-n600">{d.texto}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
