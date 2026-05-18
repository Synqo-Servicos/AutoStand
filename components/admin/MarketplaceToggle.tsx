"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

interface Props {
  initial: boolean;
}

/** Liga/desliga a adesão da loja ao marketplace AutoStand. */
export function MarketplaceToggle({ initial }: Props) {
  const [optIn, setOptIn] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !optIn;
    setSaving(true);
    setError(null);
    setOptIn(next);
    try {
      const res = await fetch("/api/marketplace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketplace_opt_in: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      setOptIn(data.marketplace_opt_in);
    } catch (err) {
      setOptIn(!next);
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        role="switch"
        aria-checked={optIn}
        disabled={saving}
        onClick={toggle}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-60 ${
          optIn ? "bg-signal" : "bg-n300"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            optIn ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      <div className="text-sm">
        <span className="font-medium text-ink">
          {optIn ? "A loja está no marketplace" : "A loja está fora do marketplace"}
        </span>
        {saving && <Loader2 className="ml-2 inline w-3.5 h-3.5 animate-spin text-n400" />}
        {error && <p className="text-xs text-danger mt-0.5">{error}</p>}
      </div>
    </div>
  );
}
