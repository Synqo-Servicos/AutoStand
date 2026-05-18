"use client";

import { useRouter } from "next/navigation";
import { ArrowUpDown } from "lucide-react";

const OPTIONS = [
  { value: "recent", label: "Mais recentes" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
  { value: "km_asc", label: "Menor quilometragem" },
];

/** Ordenação da busca do marketplace — escreve `sort` nos searchParams. */
export function MarketplaceSort({ current }: { current: Record<string, string> }) {
  const router = useRouter();

  function change(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(current);
    params.set("sort", e.target.value);
    params.delete("page");
    router.push(`/comprar?${params.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 text-sm text-n600">
      <ArrowUpDown className="h-4 w-4 text-n400" />
      <span className="hidden sm:inline">Ordenar por</span>
      <select
        value={current.sort ?? "recent"}
        onChange={change}
        className="rounded-lg border border-n200 bg-white px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-signal focus:border-transparent cursor-pointer"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
