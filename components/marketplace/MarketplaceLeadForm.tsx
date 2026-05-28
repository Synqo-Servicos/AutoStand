"use client";

import { useCallback, useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Turnstile, isTurnstileEnabled } from "@/components/Turnstile";

interface Props {
  vehicleId: number;
  vehicleLabel: string;
  lojaName: string;
}

const FIELD = "w-full rounded-lg border border-n200 bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-signal focus:border-transparent";
const LABEL = "block text-xs font-medium text-n600 mb-1";

/** Formulário de interesse — cria um lead para a loja dona do veículo. */
export function MarketplaceLeadForm({ vehicleId, vehicleLabel, lojaName }: Props) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    message: `Olá! Tenho interesse no ${vehicleLabel}.`,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const onCaptchaExpire = useCallback(() => setCaptchaToken(null), []);

  const captchaEnabled = isTurnstileEnabled();
  const canSubmit = !saving && (!captchaEnabled || captchaToken !== null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/marketplace/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          vehicle_id: vehicleId,
          turnstile_token: captchaToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar");
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-success/30 bg-success/10 px-6 py-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-success" />
        <p className="mt-3 text-sm font-semibold text-ink">Contato enviado!</p>
        <p className="mt-1 text-sm text-n600">
          A {lojaName} recebeu seu interesse e vai falar com você em breve.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className={LABEL}>Nome *</label>
        <input
          required type="text" value={form.name}
          onChange={(e) => set("name", e.target.value)}
          className={FIELD} placeholder="Seu nome"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Telefone *</label>
          <input
            required type="tel" value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            className={FIELD} placeholder="(00) 00000-0000"
          />
        </div>
        <div>
          <label className={LABEL}>E-mail</label>
          <input
            type="email" value={form.email}
            onChange={(e) => set("email", e.target.value)}
            className={FIELD} placeholder="opcional"
          />
        </div>
      </div>
      <div>
        <label className={LABEL}>Mensagem</label>
        <textarea
          rows={3} value={form.message}
          onChange={(e) => set("message", e.target.value)}
          className={`${FIELD} resize-none`}
        />
      </div>
      {captchaEnabled && <Turnstile onVerify={setCaptchaToken} onExpire={onCaptchaExpire} />}
      {error && <p className="text-xs text-danger">{error}</p>}
      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-signal px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-signal-dark disabled:opacity-50 cursor-pointer"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {saving ? "Enviando..." : "Tenho interesse"}
      </button>
      <p className="text-center text-xs text-n400">
        Seu contato vai direto para a {lojaName}.
      </p>
    </form>
  );
}
