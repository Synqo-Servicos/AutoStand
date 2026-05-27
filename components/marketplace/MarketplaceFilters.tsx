"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  FUELS, FUEL_LABELS, TRANSMISSIONS, TRANSMISSION_LABELS,
  BODY_TYPES, BODY_TYPE_LABELS,
} from "@/lib/constants";
import { Input, Select, Button, type SelectOption } from "@/components/ui";

interface Props {
  brands: string[];
  cities: string[];
  current: Record<string, string>;
  /** "card" (default): card + sticky no lg+; "inline": sem card, herda o container. */
  variant?: "card" | "inline";
}

const ANY_VALUE = "__any__";
const LABEL = "block text-eyebrow text-n700 mb-1.5";

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

  // Radix Select não aceita "" como valor — usamos um sentinela e
  // traduzimos antes de mandar pra URL.
  function setSelect<K extends keyof typeof form>(key: K, value: string) {
    set(key, value === ANY_VALUE ? "" : value);
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

  const brandOpts: SelectOption[] = [
    { value: ANY_VALUE, label: "Todas" },
    ...brands.map((b) => ({ value: b, label: b })),
  ];
  const cityOpts: SelectOption[] = [
    { value: ANY_VALUE, label: "Todas" },
    ...cities.map((c) => ({ value: c, label: c })),
  ];
  const fuelOpts: SelectOption[] = [
    { value: ANY_VALUE, label: "Todos" },
    ...FUELS.map((f) => ({ value: f, label: FUEL_LABELS[f] })),
  ];
  const transOpts: SelectOption[] = [
    { value: ANY_VALUE, label: "Todos" },
    ...TRANSMISSIONS.map((t) => ({ value: t, label: TRANSMISSION_LABELS[t] })),
  ];
  const bodyOpts: SelectOption[] = [
    { value: ANY_VALUE, label: "Todas" },
    ...BODY_TYPES.map((b) => ({ value: b, label: BODY_TYPE_LABELS[b] })),
  ];

  const wrapper =
    variant === "inline"
      ? "p-5"
      : "rounded-2xl border border-n200 bg-white p-5 lg:sticky lg:top-20 shadow-xs";

  return (
    <form onSubmit={apply} className={wrapper}>
      <div className="space-y-4">
        <div>
          <label className={LABEL}>Busca</label>
          <Input
            value={form.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Marca, modelo ou versão"
            leadingIcon={<Search className="h-4 w-4" />}
          />
        </div>

        <div>
          <label className={LABEL}>Marca</label>
          <Select
            value={form.brand || ANY_VALUE}
            onValueChange={(v) => setSelect("brand", v)}
            options={brandOpts}
          />
        </div>

        <div>
          <label className={LABEL}>Cidade</label>
          <Select
            value={form.city || ANY_VALUE}
            onValueChange={(v) => setSelect("city", v)}
            options={cityOpts}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Combustível</label>
            <Select
              value={form.fuel || ANY_VALUE}
              onValueChange={(v) => setSelect("fuel", v)}
              options={fuelOpts}
            />
          </div>
          <div>
            <label className={LABEL}>Câmbio</label>
            <Select
              value={form.transmission || ANY_VALUE}
              onValueChange={(v) => setSelect("transmission", v)}
              options={transOpts}
            />
          </div>
        </div>

        <div>
          <label className={LABEL}>Carroceria</label>
          <Select
            value={form.body_type || ANY_VALUE}
            onValueChange={(v) => setSelect("body_type", v)}
            options={bodyOpts}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Preço até (R$)</label>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={form.price_max}
              onChange={(e) => set("price_max", e.target.value)}
              placeholder="Ex: 80000"
            />
          </div>
          <div>
            <label className={LABEL}>Ano a partir de</label>
            <Input
              type="number"
              min={1990}
              value={form.year_min}
              onChange={(e) => set("year_min", e.target.value)}
              placeholder="Ex: 2020"
            />
          </div>
        </div>

        <Button type="submit" variant="primary" size="md" className="w-full">
          Aplicar filtros
        </Button>
        {hasFilters && (
          <button
            type="button"
            onClick={clear}
            className="block w-full text-center text-body-s text-n500 transition-colors hover:text-ink cursor-pointer"
          >
            Limpar filtros
          </button>
        )}
      </div>
    </form>
  );
}
