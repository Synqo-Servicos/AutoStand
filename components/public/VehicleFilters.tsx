"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { COMMON_BRANDS, FUELS, FUEL_LABELS, TRANSMISSIONS, TRANSMISSION_LABELS } from "@/lib/constants";

const sel = "w-full border border-n200 rounded-lg px-3 py-2 text-sm text-n700 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:border-transparent appearance-none";

export function VehicleFilters() {
  const router = useRouter();
  const sp = useSearchParams();

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/?${params.toString()}`);
  }, [router, sp]);

  return (
    <div className="bg-white border border-n100 rounded-2xl p-4 shadow-sm space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-n700">
        <SlidersHorizontal className="w-4 h-4 text-[var(--brand-accent)]" />
        Filtros
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-n400" />
        <input
          type="text"
          defaultValue={sp.get("search") ?? ""}
          onChange={e => update("search", e.target.value)}
          placeholder="Buscar marca ou modelo..."
          className="w-full pl-9 border border-n200 rounded-lg px-3 py-2 text-sm text-n700 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Brand */}
        <div>
          <label className="block text-xs text-n400 mb-1">Marca</label>
          <select value={sp.get("brand") ?? ""} onChange={e => update("brand", e.target.value)} className={sel}>
            <option value="">Todas</option>
            {COMMON_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* Year min */}
        <div>
          <label className="block text-xs text-n400 mb-1">Ano mín.</label>
          <input
            type="number" min="2000" max={new Date().getFullYear() + 1}
            defaultValue={sp.get("year_min") ?? ""}
            onChange={e => update("year_min", e.target.value)}
            placeholder="2018"
            className={sel}
          />
        </div>

        {/* Year max */}
        <div>
          <label className="block text-xs text-n400 mb-1">Ano máx.</label>
          <input
            type="number" min="2000" max={new Date().getFullYear() + 1}
            defaultValue={sp.get("year_max") ?? ""}
            onChange={e => update("year_max", e.target.value)}
            placeholder={String(new Date().getFullYear())}
            className={sel}
          />
        </div>

        {/* KM max */}
        <div>
          <label className="block text-xs text-n400 mb-1">KM máx.</label>
          <input
            type="number" min="0"
            defaultValue={sp.get("km_max") ?? ""}
            onChange={e => update("km_max", e.target.value)}
            placeholder="100.000"
            className={sel}
          />
        </div>

        {/* Fuel */}
        <div>
          <label className="block text-xs text-n400 mb-1">Combustível</label>
          <select value={sp.get("fuel") ?? ""} onChange={e => update("fuel", e.target.value)} className={sel}>
            <option value="">Todos</option>
            {FUELS.map(f => <option key={f} value={f}>{FUEL_LABELS[f]}</option>)}
          </select>
        </div>

        {/* Transmission */}
        <div>
          <label className="block text-xs text-n400 mb-1">Câmbio</label>
          <select value={sp.get("transmission") ?? ""} onChange={e => update("transmission", e.target.value)} className={sel}>
            <option value="">Todos</option>
            {TRANSMISSIONS.map(t => <option key={t} value={t}>{TRANSMISSION_LABELS[t]}</option>)}
          </select>
        </div>
      </div>

      {/* Price range */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-n400 mb-1">Preço mín. (R$)</label>
          <input
            type="number" min="0" step="1000"
            defaultValue={sp.get("price_min") ?? ""}
            onChange={e => update("price_min", e.target.value ? String(Number(e.target.value) * 100) : "")}
            placeholder="30.000"
            className={sel}
          />
        </div>
        <div>
          <label className="block text-xs text-n400 mb-1">Preço máx. (R$)</label>
          <input
            type="number" min="0" step="1000"
            defaultValue={sp.get("price_max") ?? ""}
            onChange={e => update("price_max", e.target.value ? String(Number(e.target.value) * 100) : "")}
            placeholder="300.000"
            className={sel}
          />
        </div>
      </div>
    </div>
  );
}
