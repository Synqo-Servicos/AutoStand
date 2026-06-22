"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import {
  COMMON_BRANDS, FUELS, FUEL_LABELS, TRANSMISSIONS, TRANSMISSION_LABELS,
  VEHICLE_STATUS, STATUS_LABELS, BODY_TYPES, BODY_TYPE_LABELS,
  CONDITIONS, CONDITION_LABELS,
} from "@/lib/constants";
import { formatBRL, displayToCents, centsToDisplay } from "@/lib/money";
import { PhotoUploader } from "./PhotoUploader";
import type { VehicleWithPhotos } from "@/types/vehicle";

interface Props {
  vehicle?: VehicleWithPhotos;
}

const inp = "w-full border border-n200 rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-signal focus:border-transparent transition-shadow";
const lbl = "block text-xs font-medium text-n600 mb-1";

export function VehicleForm({ vehicle }: Props) {
  const router = useRouter();
  const isEdit = !!vehicle;
  const currentYear = new Date().getFullYear();

  const [form, setForm] = useState({
    brand:            vehicle?.brand            ?? "",
    model:            vehicle?.model            ?? "",
    version:          vehicle?.version          ?? "",
    year:             vehicle?.year             ?? currentYear,
    year_manufacture: vehicle?.year_manufacture ?? vehicle?.year ?? currentYear,
    km:               vehicle?.km               ?? 0,
    cost_price:       vehicle?.cost_price       ?? 0,
    sale_price:       vehicle?.sale_price       ?? 0,
    transmission:     vehicle?.transmission     ?? "automatico",
    fuel:             vehicle?.fuel             ?? "flex",
    color:            vehicle?.color            ?? "",
    doors:            vehicle?.doors            ?? 4,
    body_type:        vehicle?.body_type        ?? "",
    condition:        vehicle?.condition        ?? "seminovo",
    armored:          vehicle?.armored          ?? false,
    single_owner:     vehicle?.single_owner     ?? false,
    fipe_code:        vehicle?.fipe_code        ?? "",
    plate:            (vehicle as VehicleWithPhotos & { plate?: string | null })?.plate ?? "",
    description:      vehicle?.description      ?? "",
    status:           vehicle?.status           ?? "disponivel",
    primary_photo_url: vehicle?.primary_photo_url ?? null as string | null,
  });

  const [optionals, setOptionals] = useState<string[]>(vehicle?.optionals ?? []);
  const [optionalDraft, setOptionalDraft] = useState("");
  const [costDisplay,   setCostDisplay]   = useState(vehicle ? centsToDisplay(vehicle.cost_price) : "");
  const [salePriceDisp, setSalePriceDisp] = useState(vehicle ? centsToDisplay(vehicle.sale_price) : "");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function addOptional() {
    const value = optionalDraft.trim();
    if (value && !optionals.includes(value)) {
      setOptionals(list => [...list, value]);
    }
    setOptionalDraft("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        version:   form.version.trim()   || null,
        body_type: form.body_type        || null,
        fipe_code: form.fipe_code.trim()  || null,
        plate:     form.plate.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || null,
        optionals: optionals.length ? optionals : null,
      };
      const url    = isEdit ? `/api/vehicles/${vehicle.id}` : "/api/vehicles";
      const method = isEdit ? "PUT" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
        <div className="bg-white rounded-xl border border-n100 p-6">
          <h3 className="text-sm font-semibold text-ink mb-4">Fotos</h3>
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

      <div className="bg-white rounded-xl border border-n100 p-6 space-y-5">
        <h3 className="text-sm font-semibold text-ink">Dados do veículo</h3>

        {/* Placa — controle interno (sem lookup automático por enquanto) */}
        <div>
          <label className={lbl}>Placa <span className="font-normal text-n400">— opcional</span></label>
          <input
            type="text"
            value={form.plate}
            onChange={e => set("plate", e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 8))}
            className={`${inp} uppercase tracking-wider`}
            placeholder="ABC-1D23"
          />
          <p className="text-xs text-n500 mt-1">
            Usada para controle interno da loja. Não aparece no anúncio público.
          </p>
        </div>

        {/* Brand + Model */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <input required type="text" value={form.model} onChange={e => set("model", e.target.value)} className={inp} placeholder="Ex: Onix Plus" />
          </div>
        </div>

        {/* Version + FIPE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Versão</label>
            <input type="text" value={form.version} onChange={e => set("version", e.target.value)} className={inp} placeholder="Ex: 1.0 Turbo Premier" />
          </div>
          <div>
            <label className={lbl}>Código FIPE</label>
            <input type="text" value={form.fipe_code} onChange={e => set("fipe_code", e.target.value)} className={inp} placeholder="Ex: 004445-0" />
          </div>
        </div>

        {/* Year model + Year manufacture + KM */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={lbl}>Ano modelo *</label>
            <input required type="number" min="1990" max={currentYear + 1}
              value={form.year} onChange={e => set("year", Number(e.target.value))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Ano fabricação *</label>
            <input required type="number" min="1990" max={currentYear + 1}
              value={form.year_manufacture} onChange={e => set("year_manufacture", Number(e.target.value))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Quilometragem *</label>
            <input required type="number" min="0"
              value={form.km} onChange={e => set("km", Number(e.target.value))} className={inp} />
          </div>
        </div>

        {/* Transmission + Fuel + Doors */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <label className={lbl}>Portas *</label>
            <select required value={form.doors} onChange={e => set("doors", Number(e.target.value))} className={inp}>
              {[2, 4].map(d => <option key={d} value={d}>{d} portas</option>)}
            </select>
          </div>
        </div>

        {/* Body type + Color + Condition */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={lbl}>Carroceria</label>
            <select value={form.body_type} onChange={e => set("body_type", e.target.value)} className={inp}>
              <option value="">Selecione...</option>
              {BODY_TYPES.map(b => <option key={b} value={b}>{BODY_TYPE_LABELS[b]}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Cor *</label>
            <input required type="text" value={form.color} onChange={e => set("color", e.target.value)} className={inp} placeholder="Ex: Prata" />
          </div>
          <div>
            <label className={lbl}>Condição *</label>
            <select required value={form.condition} onChange={e => set("condition", e.target.value)} className={inp}>
              {CONDITIONS.map(c => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
            </select>
          </div>
        </div>

        {/* Cost + Sale Price */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <p className={`text-xs mt-1 ${form.sale_price > form.cost_price ? "text-ink" : "text-danger"}`}>
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
            placeholder="Estado de conservação, histórico, garantia..."
          />
        </div>
      </div>

      {/* Destaques do anúncio — alimentam o post de Instagram e os portais */}
      <div className="bg-white rounded-xl border border-n100 p-6 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-ink">Destaques do anúncio</h3>
          <p className="text-xs text-n500 mt-0.5">
            Usados na geração de posts e nos anúncios para portais (OLX, Webmotors).
          </p>
        </div>

        {/* Opcionais — chips */}
        <div>
          <label className={lbl}>Opcionais</label>
          {optionals.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {optionals.map(opt => (
                <span key={opt} className="inline-flex items-center gap-1 bg-n100 text-ink text-xs rounded-full pl-2.5 pr-1 py-1">
                  {opt}
                  <button
                    type="button"
                    onClick={() => setOptionals(list => list.filter(o => o !== opt))}
                    className="rounded-full p-0.5 hover:bg-n200 transition-colors cursor-pointer"
                    aria-label={`Remover ${opt}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={optionalDraft}
              onChange={e => setOptionalDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") { e.preventDefault(); addOptional(); }
              }}
              className={inp}
              placeholder="Ex: Teto solar — Enter para adicionar"
            />
            <button
              type="button"
              onClick={addOptional}
              className="shrink-0 px-3 py-2 text-sm border border-n200 rounded-lg text-n600 hover:bg-n50 transition-colors cursor-pointer"
            >
              Adicionar
            </button>
          </div>
        </div>

        {/* Flags */}
        <div className="flex flex-wrap gap-6">
          <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={form.armored}
              onChange={e => set("armored", e.target.checked)}
              className="w-4 h-4 rounded border-n300 text-signal focus:ring-signal"
            />
            Blindado
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={form.single_owner}
              onChange={e => set("single_owner", e.target.checked)}
              className="w-4 h-4 rounded border-n300 text-signal focus:ring-signal"
            />
            Único dono
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      {!isEdit && (
        <div className="rounded-xl bg-signal/10 border border-signal p-4 text-sm text-signal">
          Após salvar, você poderá adicionar as fotos do veículo.
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {isEdit ? (
          <button
            type="button"
            onClick={handleDelete}
            className="text-sm text-danger hover:text-danger hover:bg-danger/10 px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            Excluir veículo
          </button>
        ) : <div />}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm border border-n200 rounded-lg text-n600 hover:bg-n50 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-signal text-ink rounded-lg hover:bg-signal-dark disabled:opacity-50 transition-colors cursor-pointer"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar veículo"}
          </button>
        </div>
      </div>
    </form>
  );
}
