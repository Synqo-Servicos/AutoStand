"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";

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
    <div className="p-4 sm:p-8 max-w-lg">
      <h1 className="font-display text-h1 font-semibold text-ink mb-8">Novo cupom</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Código do cupom" required>
          {(f) => (
            <Input
              id={f.id}
              className="font-mono uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
              placeholder="PROMO10"
              required
            />
          )}
        </Field>

        <Field label="Descrição (opcional)">
          {(f) => (
            <Input
              id={f.id}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Campanha de junho"
            />
          )}
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-eyebrow text-n700">Tipo de desconto</span>
          <div className="grid grid-cols-3 gap-2">
            {([
              ["percentage", "% desconto"],
              ["fixed", "R$ desconto"],
              ["free_month", "1º mês grátis"],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setDiscountType(val)}
                className={`rounded-md border px-3 py-2 text-body-s font-medium transition-colors ${
                  discountType === val
                    ? "border-signal bg-signal/10 text-ink"
                    : "border-n300 text-n600 hover:border-n400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {discountType !== "free_month" && (
          <Field label={discountType === "percentage" ? "Percentual (%)" : "Valor (R$)"} required>
            {(f) => (
              <Input
                id={f.id}
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "percentage" ? "10" : "50"}
                min="0"
                max={discountType === "percentage" ? "100" : undefined}
                required
              />
            )}
          </Field>
        )}

        <Field label="Número máximo de usos" required>
          {(f) => (
            <Input
              id={f.id}
              type="number"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              min="1"
              required
            />
          )}
        </Field>

        <Field label="Validade (opcional)">
          {(f) => (
            <Input
              id={f.id}
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          )}
        </Field>

        {error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={submitting} className="flex-1">
            Criar cupom
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
