"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

export function LeadForm({
  vehicleId,
  vehicleLabel,
}: {
  vehicleId: number;
  vehicleLabel: string;
}) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    message: `Tenho interesse no ${vehicleLabel}.`,
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, vehicle_id: vehicleId, source: "site" }),
    });
    if (!res.ok) {
      setError("Não foi possível enviar agora. Tente novamente.");
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
  }

  if (done) {
    return (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
        <p className="text-sm font-semibold text-emerald-800">Recebemos seu contato!</p>
        <p className="text-xs text-emerald-700 mt-1">A concessionária vai falar com você em breve.</p>
      </div>
    );
  }

  const inputClass =
    "w-full border border-n200 rounded-lg px-3 py-2 text-sm text-n800 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:border-transparent transition-shadow";

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-xl border border-n200 p-5 bg-n50">
      <p className="text-sm font-semibold text-n800">Tenho interesse</p>
      <p className="text-xs text-n500 mt-0.5 mb-4">
        Deixe seu contato e a concessionária retorna para você.
      </p>
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}
      <div className="space-y-3">
        <input
          required
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Seu nome"
          className={inputClass}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            required
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="WhatsApp / telefone"
            inputMode="tel"
            className={inputClass}
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="Email (opcional)"
            className={inputClass}
          />
        </div>
        <textarea
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-d)] text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? "Enviando..." : "Enviar contato"}
      </button>
    </form>
  );
}
