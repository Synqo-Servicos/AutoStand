import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, SearchX, SlidersHorizontal } from "lucide-react";
import { requirePlatformHost } from "@/lib/tenant";
import {
  searchMarketplaceVehicles,
  marketplaceFilterOptions,
  MARKETPLACE_PAGE_SIZE,
  type MarketplaceFilters,
  type MarketplaceSort,
} from "@/lib/marketplace";
import { recordSearch } from "@/lib/demand";
import { MarketplaceVehicleCard } from "@/components/marketplace/MarketplaceVehicleCard";
import { MarketplaceFilters as Filters } from "@/components/marketplace/MarketplaceFilters";
import { MarketplaceSort as SortControl } from "@/components/marketplace/MarketplaceSort";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Comprar um carro — AutoStand",
  description: "Seminovos de concessionárias multimarca selecionadas. Busque por marca, preço, cidade e mais.",
};

const SORTS: MarketplaceSort[] = ["recent", "price_asc", "price_desc", "km_asc"];

function num(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** URL da busca para uma dada página, preservando filtros e ordenação. */
function pageHref(sp: Record<string, string>, page: number): string {
  const params = new URLSearchParams(sp);
  if (page <= 1) params.delete("page");
  else params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/comprar?${qs}` : "/comprar";
}

export default async function ComprarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requirePlatformHost();
  const sp = await searchParams;

  const reais = num(sp.price_max);
  const sort = SORTS.includes(sp.sort as MarketplaceSort)
    ? (sp.sort as MarketplaceSort)
    : "recent";
  const page = Math.max(1, num(sp.page) ?? 1);

  const filters: MarketplaceFilters = {
    search:       sp.search?.trim() || undefined,
    brand:        sp.brand?.trim() || undefined,
    city:         sp.city?.trim() || undefined,
    fuel:         sp.fuel?.trim() || undefined,
    transmission: sp.transmission?.trim() || undefined,
    body_type:    sp.body_type?.trim() || undefined,
    year_min:     num(sp.year_min),
    price_max:    reais ? reais * 100 : undefined,
    sort,
    page,
  };

  const [{ vehicles, total }, options] = await Promise.all([
    searchMarketplaceVehicles(filters),
    marketplaceFilterOptions(),
    // Registra a busca como sinal de demanda (anônimo). Só na 1ª página,
    // para a paginação não contar a mesma busca várias vezes.
    page === 1
      ? recordSearch({
          tenantId: null,
          brand: filters.brand,
          bodyType: filters.body_type,
          fuel: filters.fuel,
          transmission: filters.transmission,
          city: filters.city,
          price: filters.price_max,
          yearMin: filters.year_min,
          searchTerm: filters.search,
        })
      : Promise.resolve(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / MARKETPLACE_PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * MARKETPLACE_PAGE_SIZE + 1;
  const to = (page - 1) * MARKETPLACE_PAGE_SIZE + vehicles.length;

  const activeFilterCount = [
    sp.search, sp.brand, sp.city, sp.fuel, sp.transmission,
    sp.body_type, sp.price_max, sp.year_min,
  ].filter((v) => v && v.trim()).length;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-5 py-6 sm:py-10">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-ink">Comprar um carro</h1>
        <p className="mt-1 text-sm text-n600">
          {total}{" "}
          {total === 1 ? "veículo disponível" : "veículos disponíveis"} em
          concessionárias da rede AutoStand.
        </p>
      </header>

      <div className="grid gap-6 lg:gap-8 lg:grid-cols-[260px_1fr]">
        <aside>
          {/* Mobile: filtros em <details> colapsado por padrão */}
          <details className="lg:hidden rounded-2xl border border-n200 bg-white mb-4 group">
            <summary className="cursor-pointer list-none flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-ink">
              <span className="inline-flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-n500" />
                Filtros
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-signal/20 text-signal px-2 py-0.5 text-[11px] font-semibold">
                    {activeFilterCount}
                  </span>
                )}
              </span>
              <ChevronDown className="h-4 w-4 text-n400 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-n100">
              <Filters brands={options.brands} cities={options.cities} current={sp} variant="inline" />
            </div>
          </details>
          {/* Desktop: sticky sidebar */}
          <div className="hidden lg:block">
            <Filters brands={options.brands} cities={options.cities} current={sp} />
          </div>
        </aside>

        <div>
          {vehicles.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Nenhum veículo encontrado"
              description="Tente ajustar ou limpar os filtros para ver mais opções do catálogo."
              className="rounded-2xl border border-dashed border-n300 bg-white"
              cta={
                activeFilterCount > 0 ? (
                  <Link
                    href="/comprar"
                    className="inline-flex items-center gap-1 rounded-lg border border-n200 bg-white px-3 py-2 text-sm text-ink hover:bg-n50 transition-colors"
                  >
                    Limpar filtros
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="mb-5 flex items-center justify-between gap-4">
                <p className="text-xs text-n500">
                  Mostrando {from}–{to} de {total}
                </p>
                <SortControl current={sp} />
              </div>

              <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {vehicles.map((v) => (
                  <MarketplaceVehicleCard key={v.id} vehicle={v} />
                ))}
              </div>

              {totalPages > 1 && (
                <nav className="mt-8 flex items-center justify-center gap-2">
                  {page > 1 ? (
                    <Link
                      href={pageHref(sp, page - 1)}
                      className="inline-flex items-center gap-1 rounded-lg border border-n200 bg-white px-3 py-2 text-sm text-ink hover:bg-n50 transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-n100 px-3 py-2 text-sm text-n300">
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </span>
                  )}
                  <span className="px-3 text-sm text-n600">
                    Página {page} de {totalPages}
                  </span>
                  {page < totalPages ? (
                    <Link
                      href={pageHref(sp, page + 1)}
                      className="inline-flex items-center gap-1 rounded-lg border border-n200 bg-white px-3 py-2 text-sm text-ink hover:bg-n50 transition-colors"
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-n100 px-3 py-2 text-sm text-n300">
                      Próxima
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  )}
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
