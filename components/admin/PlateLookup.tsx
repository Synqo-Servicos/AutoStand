"use client";

import { useState } from "react";
import { Loader2, ScanLine, Sparkles } from "lucide-react";
import type { VehicleLookupResult } from "@/lib/placa";

interface Props {
  value: string;
  onChange: (plate: string) => void;
  onLookup: (data: VehicleLookupResult) => void;
}

const STORAGE = {
  baseInput: "w-full border border-n200 rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-signal focus:border-transparent transition-shadow uppercase tracking-wider",
  label: "block text-xs font-medium text-n600 mb-1",
};

function maskPlate(raw: string): string {
  // Aceita ABC1234, ABC-1234, ABC1D23 (Mercosul).
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
}

export function PlateLookup({ value, onChange, onLookup }: Props) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<
    | { kind: "ok"; demo: boolean; brand: string | null; model: string | null }
    | { kind: "err"; message: string }
    | null
  >(null);

  async function consult() {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleaned.length !== 7) {
      setFeedback({ kind: "err", message: "Placa precisa ter 7 caracteres (ex.: ABC1D23)." });
      return;
    }
    setFeedback(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/placa?placa=${cleaned}`);
      const body = (await res.json()) as VehicleLookupResult | { error?: string; reason?: string };
      if (!res.ok || "error" in body) {
        setFeedback({
          kind: "err",
          message: ("error" in body && body.error) || "Falha na consulta.",
        });
        return;
      }
      const data = body as VehicleLookupResult;
      onLookup(data);
      setFeedback({ kind: "ok", demo: data.isDemo, brand: data.brand, model: data.model });
    } catch (err) {
      setFeedback({ kind: "err", message: err instanceof Error ? err.message : "Erro de rede." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className={STORAGE.label}>
        Placa (Mercosul ou antiga) <span className="font-normal text-n400">— opcional</span>
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          inputMode="text"
          value={value}
          onChange={(e) => onChange(maskPlate(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              consult();
            }
          }}
          placeholder="ABC-1D23"
          className={STORAGE.baseInput + " sm:flex-1"}
        />
        <button
          type="button"
          onClick={consult}
          disabled={busy || !value.trim()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-ink text-white text-sm font-semibold hover:bg-ink/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
          Buscar dados
        </button>
      </div>
      {feedback?.kind === "ok" && (
        <p className="mt-2 text-xs inline-flex items-center gap-1.5 text-success">
          <Sparkles className="w-3.5 h-3.5" />
          Dados preenchidos
          {feedback.brand && `: ${feedback.brand} ${feedback.model ?? ""}`}
          {feedback.demo && (
            <span className="ml-1 text-n500 italic">(modo demonstração — configure APIBRASIL_* em prod)</span>
          )}
        </p>
      )}
      {feedback?.kind === "err" && (
        <p className="mt-2 text-xs text-danger">{feedback.message}</p>
      )}
      <p className="text-xs text-n500 mt-1">
        Consulta marca, modelo, ano, cor, combustível e código FIPE.
        Nenhum dado pessoal do antigo proprietário é exibido ou armazenado.
      </p>
    </div>
  );
}
