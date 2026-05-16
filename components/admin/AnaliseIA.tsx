"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import type { Analise } from "@/lib/ai";

const SEVERIDADE: Record<string, { label: string; cls: string }> = {
  alta: { label: "Alta", cls: "bg-danger/10 text-ink ring-1 ring-danger/30" },
  media: { label: "Média", cls: "bg-warning/15 text-ink ring-1 ring-warning/40" },
  baixa: { label: "Baixa", cls: "bg-n100 text-n600 ring-1 ring-n200" },
};
const SEV_ORDER: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
const AREA: Record<string, string> = {
  marca: "Marca",
  layout: "Layout",
  catalogo: "Catálogo",
  conteudo: "Conteúdo",
};

export function AnaliseIA({ configured }: { configured: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analise, setAnalise] = useState<Analise | null>(null);

  async function analisar() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analise", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Não foi possível gerar a análise.");
      else setAnalise(data.analise);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
    setLoading(false);
  }

  const recs = analise
    ? [...analise.recomendacoes].sort(
        (a, b) => SEV_ORDER[a.severidade] - SEV_ORDER[b.severidade],
      )
    : [];

  return (
    <div>
      {!configured && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-warning/15 px-3 py-2 text-body-s text-ink">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          A análise de IA ainda não foi configurada (chave de API ausente).
        </div>
      )}

      <button
        onClick={analisar}
        disabled={loading || !configured}
        className="inline-flex items-center gap-2 rounded-lg bg-signal px-5 py-2.5 font-semibold text-ink transition-colors hover:bg-signal-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {loading ? "Analisando…" : "Analisar minha vitrine"}
      </button>

      {error && (
        <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-body-s text-danger">{error}</p>
      )}

      {analise && (
        <div className="mt-6 space-y-4">
          <p className="rounded-xl border border-n200 bg-white p-4 text-body text-ink">
            {analise.resumo}
          </p>
          {recs.map((r, i) => (
            <div key={i} className="rounded-xl border border-n200 bg-white p-4">
              <div className="flex items-center gap-2">
                <span className="text-eyebrow font-semibold uppercase text-n600">
                  {AREA[r.area] ?? r.area}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-eyebrow font-medium ${
                    SEVERIDADE[r.severidade]?.cls ?? ""
                  }`}
                >
                  {SEVERIDADE[r.severidade]?.label ?? r.severidade}
                </span>
              </div>
              <h3 className="mt-1.5 font-display text-h3 font-semibold text-ink">{r.titulo}</h3>
              <p className="mt-1 text-body-s text-n600">{r.sugestao}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
