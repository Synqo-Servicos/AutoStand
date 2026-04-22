"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { COMMON_BRANDS, FUELS, FUEL_LABELS, TRANSMISSIONS, TRANSMISSION_LABELS, VEHICLE_STATUS, STATUS_LABELS } from "@/lib/constants";
import { formatBRL, displayToCents, centsToDisplay } from "@/lib/money";
import { PhotoUploader } from "./PhotoUploader";
import type { VehicleWithPhotos } from "@/types/vehicle";

interface Props {
  vehicle?: VehicleWithPhotos;
}

const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow";
const lbl = "block text-xs font-medium text-slate-500 mb-1";

export function VehicleForm({ vehicle }: Props) {
  const router = useRouter();
  const isEdit = !!vehicle;

  const [form, setForm] = useState({
    brand:        vehicle?.brand        ?? "",
    model:        vehicle?.model        ?? "",
    year:         vehicle?.year         ?? new Date().getFullYear(),
    km:           vehicle?.km           ?? 0,
    cost_price:   vehicle?.cost_price   ?? 0,
    sale_price:   vehicle?.sale_price   ?? 0,
    transmission: vehicle?.transmission ?? "automatico",
    fuel:         vehicle?.fuel         ?? "flex",
    color:        vehicle?.color        ?? "",
    doors:        vehicle?.doors        ?? 4,
    description:  vehicle?.description  ?? "",
    status:       vehicle?.status       ?? "disponivel",
    primary_photo_url: vehicle?.primary_photo_url ?? null as string | null,
  });

  const [costDisplay,   setCostDisplay]   = useState(vehicle ? centsToDisplay(vehicle.cost_price) : "");
  const [salePriceDisp, setSalePriceDisp] = useState(vehicle ? centsToDisplay(vehicle.sale_price) : "");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const url    = isEdit ? `/api/vehicles/${vehicle.id}` : "/api/vehicles";
      const method = isEdit ? "PUT" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");

      if (!isEdit) {
        router.push(`/admin/veiculos/${data.id}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!vehicle || !confirm(`Excluir ${vehicle.brand} ${vehicle.model}?`)) return;
    await fetch(`/api/vehicles/${vehicle.id}`, { method: "DELETE" });
    router.push("/admin/veiculos");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">

      {/* Fotos — só no modo edição */}
      {isEdit && (
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Fotos</h3>
          <PhotoUploader
            vehicleId={vehicle.id}
            initialPhotos={vehicle.photos.map(p => ({
              url: p.url,
              isPrimary: p.url === vehicle.primary_photo_url,
            }))}
            onChange={url => set("primary_photo_url", url)}
          />
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-5">
        <h3 className="text-sm font-semibold text-slate-700">Dados do veículo</h3>

        {/* Brand + Model */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Marca *</label>
            <select required value={form.brand} onChange={e => set("brand", e.target.value)} className={inp}>
              <option value="">Selecione...</option>
              {COMMON_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              <option value="Outro">Outro</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Modelo *</label>
            <input required type="text" value={form.model} onChange={e => set("model", e.target.value)} className={inp} placeholder="Ex: Onix Plus Premier" />
          </div>
        </div>

        {/* Year + KM + Doors */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={lbl}>Ano *</label>
            <input required type="number" min="1990" max={new Date().getFullYear() + 1}
              value={form.year} onChange={e => set("year", Number(e.target.value))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Quilometragem *</label>
            <input required type="number" min="0"
              value={form.km} onChange={e => set("km", Number(e.target.value))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Portas *</label>
            <select required value={form.doors} onChange={e => set("doors", Number(e.target.value))} className={inp}>
              {[2, 4].map(d => <option key={d} value={d}>{d} portas</option>)}
            </select>
          </div>
        </div>

        {/* Transmission + Fuel + Color */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={lbl}>Câmbio *</label>
            <select required value={form.transmission} onChange={e => set("transmission", e.target.value)} className={inp}>
              {TRANSMISSIONS.map(t => <option key={t} value={t}>{TRANSMISSION_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Combustível *</label>
            <select required value={form.fuel} onChange={e => set("fuel", e.target.value)} className={inp}>
              {FUELS.map(f => <option key={f} value={f}>{FUEL_LABELS[f]}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Cor *</label>
            <input required type="text" value={form.color} onChange={e => set("color", e.target.value)} className={inp} placeholder="Ex: Prata" />
          </div>
        </div>

        {/* Cost + Sale Price */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Preço de custo (R$) *</label>
            <input
              required type="text" value={costDisplay}
              onChange={e => setCostDisplay(e.target.value)}
              onBlur={() => {
                const cents = displayToCents(costDisplay);
                set("cost_price", cents);
                setCostDisplay(centsToDisplay(cents));
              }}
              className={inp} placeholder="Ex: 65.000"
            />
          </div>
          <div>
            <label className={lbl}>Preço de venda (R$) *</label>
            <input
              required type="text" value={salePriceDisp}
              onChange={e => setSalePriceDisp(e.target.value)}
              onBlur={() => {
                const cents = displayToCents(salePriceDisp);
                set("sale_price", cents);
                setSalePriceDisp(centsToDisplay(cents));
              }}
              className={inp} placeholder="Ex: 79.900"
            />
            {form.cost_price > 0 && form.sale_price > 0 && (
              <p className={`text-xs mt-1 ${form.sale_price > form.cost_price ? "text-emerald-600" : "text-red-600"}`}>
                Margem: {formatBRL(form.sale_price - form.cost_price)}
              </p>
            )}
          </div>
        </div>

        {/* Status */}
        <div>
          <label className={lbl}>Status *</label>
          <select required value={form.status} onChange={e => set("status", e.target.value)} className={inp}>
            {VEHICLE_STATUS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className={lbl}>Descrição</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={e => set("description", e.target.value)}
            className={`${inp} resize-none`}
            placeholder="Opcionais, estado de conservação, histórico..."
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {!isEdit && (
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-700">
          Após salvar, você poderá adicionar as fotos do veículo.
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        {isEdit ? (
          <button
            type="button"
            onClick={handleDelete}
            className="text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            Excluir veículo
          </button>
        ) : <div />}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar veículo"}
          </button>
        </div>
      </div>
    </form>
  );
}
