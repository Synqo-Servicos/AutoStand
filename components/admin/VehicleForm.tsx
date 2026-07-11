"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  COMMON_BRANDS, FUELS, FUEL_LABELS, TRANSMISSIONS, TRANSMISSION_LABELS,
  VEHICLE_STATUS, STATUS_LABELS, BODY_TYPES, BODY_TYPE_LABELS,
  CONDITIONS, CONDITION_LABELS,
} from "@/lib/constants";
import { formatBRL, displayToCents, centsToDisplay } from "@/lib/money";
import { PhotoUploader } from "./PhotoUploader";
import { Field, Input, Textarea, Select, Button, useConfirm, type SelectOption } from "@/components/ui";
import type { VehicleWithPhotos } from "@/types/vehicle";

interface Props {
  vehicle?: VehicleWithPhotos;
}

const brandOptions: SelectOption[] = [
  ...COMMON_BRANDS.map((b) => ({ value: b, label: b })),
  { value: "Outro", label: "Outro" },
];
const transmissionOptions: SelectOption[] = TRANSMISSIONS.map((t) => ({ value: t, label: TRANSMISSION_LABELS[t] }));
const fuelOptions: SelectOption[] = FUELS.map((f) => ({ value: f, label: FUEL_LABELS[f] }));
const doorsOptions: SelectOption[] = [2, 4].map((d) => ({ value: String(d), label: `${d} portas` }));
const bodyTypeOptions: SelectOption[] = BODY_TYPES.map((b) => ({ value: b, label: BODY_TYPE_LABELS[b] }));
const conditionOptions: SelectOption[] = CONDITIONS.map((c) => ({ value: c, label: CONDITION_LABELS[c] }));
const statusOptions: SelectOption[] = VEHICLE_STATUS.map((s) => ({ value: s, label: STATUS_LABELS[s] }));

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

  const { confirm, dialog } = useConfirm();

  async function handleDelete() {
    if (!vehicle) return;
    if (!(await confirm({ title: `Excluir ${vehicle.brand} ${vehicle.model}?`, confirmLabel: "Excluir", danger: true }))) return;
    await fetch(`/api/vehicles/${vehicle.id}`, { method: "DELETE" });
    router.push("/admin/veiculos");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {dialog}

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
        <Field
          label="Placa — opcional"
          helperText="Usada para controle interno da loja. Não aparece no anúncio público."
        >
          {(f) => (
            <Input
              id={f.id}
              type="text"
              value={form.plate}
              onChange={e => set("plate", e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 8))}
              className="uppercase tracking-wider"
              placeholder="ABC-1D23"
            />
          )}
        </Field>

        {/* Brand + Model */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Marca" required>
            {(f) => (
              <Select
                id={f.id}
                value={form.brand}
                onValueChange={v => set("brand", v)}
                options={brandOptions}
                placeholder="Selecione..."
              />
            )}
          </Field>
          <Field label="Modelo" required>
            {(f) => (
              <Input id={f.id} required type="text" value={form.model} onChange={e => set("model", e.target.value)} placeholder="Ex: Onix Plus" />
            )}
          </Field>
        </div>

        {/* Version + FIPE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Versão">
            {(f) => (
              <Input id={f.id} type="text" value={form.version} onChange={e => set("version", e.target.value)} placeholder="Ex: 1.0 Turbo Premier" />
            )}
          </Field>
          <Field label="Código FIPE">
            {(f) => (
              <Input id={f.id} type="text" value={form.fipe_code} onChange={e => set("fipe_code", e.target.value)} placeholder="Ex: 004445-0" />
            )}
          </Field>
        </div>

        {/* Year model + Year manufacture + KM */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Ano modelo" required>
            {(f) => (
              <Input
                id={f.id} required type="number" min="1990" max={currentYear + 1}
                value={form.year} onChange={e => set("year", Number(e.target.value))}
              />
            )}
          </Field>
          <Field label="Ano fabricação" required>
            {(f) => (
              <Input
                id={f.id} required type="number" min="1990" max={currentYear + 1}
                value={form.year_manufacture} onChange={e => set("year_manufacture", Number(e.target.value))}
              />
            )}
          </Field>
          <Field label="Quilometragem" required>
            {(f) => (
              <Input
                id={f.id} required type="number" min="0"
                value={form.km} onChange={e => set("km", Number(e.target.value))}
              />
            )}
          </Field>
        </div>

        {/* Transmission + Fuel + Doors */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Câmbio" required>
            {(f) => (
              <Select id={f.id} value={form.transmission} onValueChange={v => set("transmission", v)} options={transmissionOptions} />
            )}
          </Field>
          <Field label="Combustível" required>
            {(f) => (
              <Select id={f.id} value={form.fuel} onValueChange={v => set("fuel", v)} options={fuelOptions} />
            )}
          </Field>
          <Field label="Portas" required>
            {(f) => (
              <Select id={f.id} value={String(form.doors)} onValueChange={v => set("doors", Number(v))} options={doorsOptions} />
            )}
          </Field>
        </div>

        {/* Body type + Color + Condition */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Carroceria">
            {(f) => (
              <Select id={f.id} value={form.body_type} onValueChange={v => set("body_type", v)} options={bodyTypeOptions} placeholder="Selecione..." />
            )}
          </Field>
          <Field label="Cor" required>
            {(f) => (
              <Input id={f.id} required type="text" value={form.color} onChange={e => set("color", e.target.value)} placeholder="Ex: Prata" />
            )}
          </Field>
          <Field label="Condição" required>
            {(f) => (
              <Select id={f.id} value={form.condition} onValueChange={v => set("condition", v)} options={conditionOptions} />
            )}
          </Field>
        </div>

        {/* Cost + Sale Price */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Preço de custo (R$)" required>
            {(f) => (
              <Input
                id={f.id}
                required type="text" value={costDisplay}
                onChange={e => setCostDisplay(e.target.value)}
                onBlur={() => {
                  const cents = displayToCents(costDisplay);
                  set("cost_price", cents);
                  setCostDisplay(centsToDisplay(cents));
                }}
                placeholder="Ex: 65.000"
              />
            )}
          </Field>
          <div>
            <Field label="Preço de venda (R$)" required>
              {(f) => (
                <Input
                  id={f.id}
                  required type="text" value={salePriceDisp}
                  onChange={e => setSalePriceDisp(e.target.value)}
                  onBlur={() => {
                    const cents = displayToCents(salePriceDisp);
                    set("sale_price", cents);
                    setSalePriceDisp(centsToDisplay(cents));
                  }}
                  placeholder="Ex: 79.900"
                />
              )}
            </Field>
            {form.cost_price > 0 && form.sale_price > 0 && (
              <p className={`text-xs mt-1 ${form.sale_price > form.cost_price ? "text-ink" : "text-danger"}`}>
                Margem: {formatBRL(form.sale_price - form.cost_price)}
              </p>
            )}
          </div>
        </div>

        {/* Status */}
        <Field label="Status" required>
          {(f) => (
            <Select id={f.id} value={form.status} onValueChange={v => set("status", v)} options={statusOptions} />
          )}
        </Field>

        {/* Description */}
        <Field label="Descrição">
          {(f) => (
            <Textarea
              id={f.id}
              rows={3}
              value={form.description}
              onChange={e => set("description", e.target.value)}
              className="resize-none"
              placeholder="Estado de conservação, histórico, garantia..."
            />
          )}
        </Field>
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
          <label className="mb-1.5 block text-eyebrow text-n700">Opcionais</label>
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
            <Input
              type="text"
              value={optionalDraft}
              onChange={e => setOptionalDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") { e.preventDefault(); addOptional(); }
              }}
              placeholder="Ex: Teto solar — Enter para adicionar"
            />
            <Button
              type="button"
              variant="outline"
              onClick={addOptional}
              className="shrink-0"
            >
              Adicionar
            </Button>
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
          <Button
            type="button"
            variant="ghost"
            onClick={handleDelete}
            className="text-danger hover:bg-danger/10"
          >
            Excluir veículo
          </Button>
        ) : <div />}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={saving}
          >
            {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar veículo"}
          </Button>
        </div>
      </div>
    </form>
  );
}
