"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import type { Vehicle } from "@/types/vehicle";
import type { Seller } from "@/types/seller";
import { centsToDisplay, displayToCents } from "@/lib/money";

interface Props {
  vehicles: Vehicle[];
  onClose: () => void;
  onSaved: () => void;
}

const inp = "w-full border border-n200 rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-signal focus:border-transparent transition-shadow";
const lbl = "block text-xs font-medium text-n600 mb-1";

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-n100 sticky top-0 bg-white">
          <h2 className="text-base font-semibold text-ink">Nova transação</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-n400 hover:bg-n100 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Tipo */}
          <div>
            <label className={lbl}>Tipo *</label>
            <div className="grid grid-cols-2 gap-2">
              {(["entrada", "saida"] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                    type === t
                      ? t === "entrada" ? "bg-signal text-ink border-signal" : "bg-success text-white border-success"
                      : "border-n200 text-n600 hover:bg-n50"
                  }`}
                >
                  {t === "entrada" ? "Entrada (compra)" : "Saída (venda)"}
                </button>
              ))}
            </div>
          </div>

          {/* Veículo */}
          <div>
            <label className={lbl}>Veículo *</label>
            <select value={vehicleId} onChange={e => {
              setVehicleId(e.target.value);
              const v = vehicles.find(vv => String(vv.id) === e.target.value);
              if (v && !amountStr) setAmountStr(centsToDisplay(type === "saida" ? v.sale_price : v.cost_price));
            }} className={inp}>
              <option value="">Selecione...</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model} {v.year} — {v.status}
                </option>
              ))}
            </select>
          </div>

          {/* Valor */}
          <div>
            <label className={lbl}>Valor (R$) *</label>
            <input
              required type="text" value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              onBlur={() => setAmountStr(centsToDisplay(displayToCents(amountStr)))}
              className={inp} placeholder="Ex: 79.900"
            />
            {selectedVehicle && (
              <p className="text-xs text-n400 mt-1">
                Sugerido: {type === "saida"
                  ? `R$ ${centsToDisplay(selectedVehicle.sale_price)} (preço de venda)`
                  : `R$ ${centsToDisplay(selectedVehicle.cost_price)} (preço de custo)`}
              </p>
            )}
          </div>

          {/* Data */}
          <div>
            <label className={lbl}>Data *</label>
            <input required type="date" value={date} onChange={e => setDate(e.target.value)} className={inp} />
          </div>

          {/* Comprador (saida only) */}
          {type === "saida" && (
            <>
              <div>
                <label className={lbl}>Nome do comprador</label>
                <input type="text" value={buyerName} onChange={e => setBuyerName(e.target.value)} className={inp} placeholder="Nome completo" />
              </div>
              <div>
                <label className={lbl}>Telefone do comprador</label>
                <input type="tel" value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)} className={inp} placeholder="82999990000" />
              </div>
              <div>
                <label className={lbl}>Vendedor</label>
                <select value={sellerId} onChange={e => setSellerId(e.target.value)} className={inp}>
                  <option value="">Sem vendedor</option>
                  {sellers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {previewCommission != null && previewCommission > 0 && (
                  <p className="text-xs text-n400 mt-1">
                    Comissão automática: R$ {centsToDisplay(previewCommission)}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Notes */}
          <div>
            <label className={lbl}>Observações</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={`${inp} resize-none`} />
          </div>

          {error && <p className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-4 py-2">{error}</p>}
        </form>

        <div className="sticky bottom-0 bg-white border-t border-n100 px-6 py-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-n200 rounded-lg text-n600 hover:bg-n50 transition-colors cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-signal text-ink rounded-lg hover:bg-signal-dark disabled:opacity-50 transition-colors cursor-pointer"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? "Salvando..." : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
