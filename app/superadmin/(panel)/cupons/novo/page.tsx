"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "w-full rounded-lg border border-n200 bg-white px-3 py-2 text-sm text-ink placeholder-n400 outline-none focus:border-signal focus:ring-2 focus:ring-signal/30";
const labelClass = "block text-sm font-medium text-ink";

export default function NovoCupomPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed" | "free_month">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/superadmin/cupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code.toUpperCase(),
        description: description || null,
        discount_type: discountType,
        discount_value: discountType !== "free_month" ? Number(discountValue) : null,
        max_uses: Number(maxUses),
        expires_at: expiresAt || null,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erro ao criar cupom.");
      setSubmitting(false);
      return;
    }
    router.push("/superadmin/cupons");
  }

  return (
    <div className="p-8 max-w-lg">
      <h1 className="font-display text-h1 font-semibold text-ink mb-8">Novo cupom</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="code" className={labelClass}>Código do cupom</label>
          <input
            id="code"
            className={`mt-1 font-mono uppercase ${inputClass}`}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
            placeholder="PROMO10"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className={labelClass}>Descrição <span className="text-n400 font-normal">(opcional)</span></label>
          <input
            id="description"
            className={`mt-1 ${inputClass}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Campanha de junho"
          />
        </div>

        <div>
          <label className={labelClass}>Tipo de desconto</label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {([
              ["percentage", "% desconto"],
              ["fixed", "R$ desconto"],
              ["free_month", "1º mês grátis"],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setDiscountType(val)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  discountType === val
                    ? "border-signal bg-signal/10 text-ink"
                    : "border-n200 text-n600 hover:border-n400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {discountType !== "free_month" && (
          <div>
            <label htmlFor="discount_value" className={labelClass}>
              {discountType === "percentage" ? "Percentual (%)" : "Valor (R$)"}
            </label>
            <input
              id="discount_value"
              type="number"
              className={`mt-1 ${inputClass}`}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === "percentage" ? "10" : "50"}
              min="0"
              max={discountType === "percentage" ? "100" : undefined}
              required
            />
          </div>
        )}

        <div>
          <label htmlFor="max_uses" className={labelClass}>Número máximo de usos</label>
          <input
            id="max_uses"
            type="number"
            className={`mt-1 ${inputClass}`}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            min="1"
            required
          />
        </div>

        <div>
          <label htmlFor="expires_at" className={labelClass}>Validade <span className="text-n400 font-normal">(opcional)</span></label>
          <input
            id="expires_at"
            type="date"
            className={`mt-1 ${inputClass}`}
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-lg bg-signal px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-signal-dark disabled:opacity-60"
          >
            {submitting ? "Criando…" : "Criar cupom"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2.5 rounded-lg border border-n200 text-sm font-medium text-n700 hover:bg-n50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
