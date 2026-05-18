import type { Metadata } from "next";
import { requirePlatformHost } from "@/lib/tenant";
import {
  searchMarketplaceVehicles,
  marketplaceFilterOptions,
  type MarketplaceFilters,
} from "@/lib/marketplace";
import { MarketplaceVehicleCard } from "@/components/marketplace/MarketplaceVehicleCard";
import { MarketplaceFilters as Filters } from "@/components/marketplace/MarketplaceFilters";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Comprar um carro — AutoStand",
  description: "Seminovos de concessionárias multimarca selecionadas. Busque por marca, preço, cidade e mais.",
};

function num(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default async function ComprarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requirePlatformHost();
  const sp = await searchParams;

  const reais = num(sp.price_max);
  const filters: MarketplaceFilters = {
    search:       sp.search?.trim() || undefined,
    brand:        sp.brand?.trim() || undefined,
    city:         sp.city?.trim() || undefined,
    fuel:         sp.fuel?.trim() || undefined,
    transmission: sp.transmission?.trim() || undefined,
    body_type:    sp.body_type?.trim() || undefined,
    year_min:     num(sp.year_min),
    price_max:    reais ? reais * 100 : undefined,
  };

  const [vehicles, options] = await Promise.all([
    searchMarketplaceVehicles(filters),
    marketplaceFilterOptions(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-ink">Comprar um carro</h1>
        <p className="mt-1 text-sm text-n600">
          {vehicles.length}{" "}
          {vehicles.length === 1 ? "veículo disponível" : "veículos disponíveis"} em
          concessionárias da rede AutoStand.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside>
          <Filters brands={options.brands} cities={options.cities} current={sp} />
        </aside>

        <div>
          {vehicles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-n300 bg-white px-6 py-16 text-center">
              <p className="text-sm font-medium text-ink">Nenhum veículo encontrado</p>
              <p className="mt-1 text-sm text-n500">
                Tente ajustar os filtros ou limpá-los para ver todo o catálogo.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {vehicles.map((v) => (
                <MarketplaceVehicleCard key={v.id} vehicle={v} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
