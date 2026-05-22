"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  FUELS, FUEL_LABELS, TRANSMISSIONS, TRANSMISSION_LABELS,
  BODY_TYPES, BODY_TYPE_LABELS,
} from "@/lib/constants";

interface Props {
  brands: string[];
  cities: string[];
  current: Record<string, string>;
  /** "card" (default): renderiza com card + sticky no lg+; "inline": sem card, herda o container. */
  variant?: "card" | "inline";
}

const FIELD = "w-full rounded-lg border border-n200 bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-signal focus:border-transparent";
const LABEL = "block text-xs font-medium text-n600 mb-1";

/** Filtros da busca do marketplace — escrevem nos searchParams da URL. */
export function MarketplaceFilters({ brands, cities, current, variant = "card" }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    search:       current.search ?? "",
    brand:        current.brand ?? "",
    city:         current.city ?? "",
    fuel:         current.fuel ?? "",
    transmission: current.transmission ?? "",
    body_type:    current.body_type ?? "",
    price_max:    current.price_max ?? "",
    year_min:     current.year_min ?? "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(form)) {
      if (value.trim()) params.set(key, value.trim());
    }
    const qs = params.toString();
    router.push(qs ? `/comprar?${qs}` : "/comprar");
  }

  function clear() {
    setForm({
      search: "", brand: "", city: "", fuel: "",
      transmission: "", body_type: "", price_max: "", year_min: "",
    });
    router.push("/comprar");
  }

  const hasFilters = Object.values(form).some((v) => v.trim());

  const wrapper =
    variant === "inline"
      ? "p-5"
      : "rounded-2xl border border-n200 bg-white p-5 lg:sticky lg:top-20";

  return (
    <form onSubmit={apply} className={wrapper}>
      <div className="space-y-4">
        <div>
          <label className={LABEL}>Busca</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-n400" />
            <input
              type="text"
              value={form.search}
              onChange={(e) => set("search", e.target.value)}
              placeholder="Marca, modelo ou versão"
              className={`${FIELD} pl-9`}
            />
          </div>
        </div>

        <div>
          <label className={LABEL}>Marca</label>
          <select value={form.brand} onChange={(e) => set("brand", e.target.value)} className={FIELD}>
            <option value="">Todas</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div>
          <label className={LABEL}>Cidade</label>
          <select value={form.city} onChange={(e) => set("city", e.target.value)} className={FIELD}>
            <option value="">Todas</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Combustível</label>
            <select value={form.fuel} onChange={(e) => set("fuel", e.target.value)} className={FIELD}>
              <option value="">Todos</option>
              {FUELS.map((f) => <option key={f} value={f}>{FUEL_LABELS[f]}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Câmbio</label>
            <select value={form.transmission} onChange={(e) => set("transmission", e.target.value)} className={FIELD}>
              <option value="">Todos</option>
              {TRANSMISSIONS.map((t) => <option key={t} value={t}>{TRANSMISSION_LABELS[t]}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={LABEL}>Carroceria</label>
          <select value={form.body_type} onChange={(e) => set("body_type", e.target.value)} className={FIELD}>
            <option value="">Todas</option>
            {BODY_TYPES.map((b) => <option key={b} value={b}>{BODY_TYPE_LABELS[b]}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Preço até (R$)</label>
            <input
              type="number" min="0" inputMode="numeric"
              value={form.price_max}
              onChange={(e) => set("price_max", e.target.value)}
              placeholder="Ex: 80000"
              className={FIELD}
            />
          </div>
          <div>
            <label className={LABEL}>Ano a partir de</label>
            <input
              type="number" min="1990"
              value={form.year_min}
              onChange={(e) => set("year_min", e.target.value)}
              placeholder="Ex: 2020"
              className={FIELD}
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-signal px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-signal-dark cursor-pointer"
        >
          Aplicar filtros
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={clear}
            className="w-full text-center text-xs text-n500 hover:text-ink transition-colors cursor-pointer"
          >
            Limpar filtros
          </button>
        )}
      </div>
    </form>
  );
}
