"use client";

import { useEffect, useState } from "react";
import type { Vehicle } from "@/types/vehicle";
import type { Seller } from "@/types/seller";
import { centsToDisplay, displayToCents } from "@/lib/money";
import { Button, Drawer, Field, Input, Select, Textarea, type SelectOption } from "@/components/ui";
import { cn } from "@/lib/cn";

interface Props {
  vehicles: Vehicle[];
  onClose: () => void;
  onSaved: () => void;
}

// Radix Select não aceita "" como valor de Item — usamos um sentinela pra
// representar "sem vendedor" e traduzimos antes de mandar pro state real.
const NONE_SELLER = "__none__";

export function TransactionSlideOver({ vehicles, onClose, onSaved }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [type,        setType]       = useState<"entrada" | "saida">("saida");
  const [vehicleId,   setVehicleId]  = useState("");
  const [amountStr,   setAmountStr]  = useState("");
  const [date,        setDate]       = useState(today);
  const [buyerName,   setBuyerName]  = useState("");
  const [buyerPhone,  setBuyerPhone] = useState("");
  const [notes,       setNotes]      = useState("");
  const [sellerId,    setSellerId]   = useState("");
  const [sellers,     setSellers]    = useState<Seller[]>([]);
  const [saving,      setSaving]     = useState(false);
  const [error,       setError]      = useState<string | null>(null);

  const selectedVehicle = vehicles.find(v => String(v.id) === vehicleId);
  const selectedSeller = sellers.find(s => String(s.id) === sellerId);

  useEffect(() => {
    if (type !== "saida") return;
    fetch("/api/sellers")
      .then(r => r.json())
      .then((rows: Seller[]) => setSellers(rows.filter(s => s.status === "ativo")))
      .catch(() => {});
  }, [type]);

  const previewCommission = (() => {
    if (type !== "saida" || !selectedSeller || !amountStr) return null;
    const cents = displayToCents(amountStr);
    const pctPart = selectedSeller.commission_pct ? Math.round((cents * selectedSeller.commission_pct) / 10000) : 0;
    const fixedPart = selectedSeller.commission_fixed_cents ?? 0;
    return pctPart + fixedPart;
  })();

  async function handleSubmit() {
    if (!vehicleId) { setError("Selecione um veículo"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id:  Number(vehicleId),
          type,
          amount:      displayToCents(amountStr),
          date,
          buyer_name:  buyerName || null,
          buyer_phone: buyerPhone || null,
          seller_id:   type === "saida" && sellerId ? Number(sellerId) : null,
          notes:       notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const vehicleOptions: SelectOption[] = vehicles.map(v => ({
    value: String(v.id),
    label: `${v.brand} ${v.model} ${v.year} — ${v.status}`,
  }));

  const sellerOptions: SelectOption[] = [
    { value: NONE_SELLER, label: "Sem vendedor" },
    ...sellers.map(s => ({ value: String(s.id), label: s.name })),
  ];

  return (
    <Drawer
      open
      onOpenChange={(next) => { if (!next) onClose(); }}
      side="right"
      title="Nova transação"
      className="max-w-md"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} loading={saving}>
            {saving ? "Salvando..." : "Registrar"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Tipo */}
        <div>
          <span className="block text-eyebrow text-n700 mb-1.5">Tipo *</span>
          <div className="grid grid-cols-2 gap-2">
            {(["entrada", "saida"] as const).map(t => (
              <Button
                key={t}
                type="button"
                variant={type === t ? "primary" : "outline"}
                onClick={() => setType(t)}
                className={cn(
                  type === t && t === "saida" &&
                    "bg-success text-white border-success hover:bg-success/90 focus-visible:ring-success/40",
                )}
              >
                {t === "entrada" ? "Entrada (compra)" : "Saída (venda)"}
              </Button>
            ))}
          </div>
        </div>

        {/* Veículo */}
        <Field label="Veículo" required>
          {(f) => (
            <Select
              id={f.id}
              value={vehicleId}
              onValueChange={(v) => {
                setVehicleId(v);
                const veh = vehicles.find(vv => String(vv.id) === v);
                if (veh && !amountStr) setAmountStr(centsToDisplay(type === "saida" ? veh.sale_price : veh.cost_price));
              }}
              options={vehicleOptions}
              placeholder="Selecione..."
            />
          )}
        </Field>

        {/* Valor */}
        <Field
          label="Valor (R$)"
          required
          helperText={selectedVehicle && (
            type === "saida"
              ? `Sugerido: R$ ${centsToDisplay(selectedVehicle.sale_price)} (preço de venda)`
              : `Sugerido: R$ ${centsToDisplay(selectedVehicle.cost_price)} (preço de custo)`
          )}
        >
          {(f) => (
            <Input
              id={f.id}
              required
              type="text"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              onBlur={() => setAmountStr(centsToDisplay(displayToCents(amountStr)))}
              placeholder="Ex: 79.900"
            />
          )}
        </Field>

        {/* Data */}
        <Field label="Data" required>
          {(f) => (
            <Input
              id={f.id}
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          )}
        </Field>

        {/* Comprador (saida only) */}
        {type === "saida" && (
          <>
            <Field label="Nome do comprador">
              {(f) => (
                <Input
                  id={f.id}
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Nome completo"
                />
              )}
            </Field>
            <Field label="Telefone do comprador">
              {(f) => (
                <Input
                  id={f.id}
                  type="tel"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="82999990000"
                />
              )}
            </Field>
            <Field
              label="Vendedor"
              helperText={previewCommission != null && previewCommission > 0
                ? `Comissão automática: R$ ${centsToDisplay(previewCommission)}`
                : undefined}
            >
              {(f) => (
                <Select
                  id={f.id}
                  value={sellerId || NONE_SELLER}
                  onValueChange={(v) => setSellerId(v === NONE_SELLER ? "" : v)}
                  options={sellerOptions}
                />
              )}
            </Field>
          </>
        )}

        {/* Notes */}
        <Field label="Observações">
          {(f) => (
            <Textarea
              id={f.id}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none"
            />
          )}
        </Field>

        {error && (
          <p className="text-body-s text-danger bg-danger/10 border border-danger/30 rounded-lg px-4 py-2">
            {error}
          </p>
        )}
      </div>
    </Drawer>
  );
}
