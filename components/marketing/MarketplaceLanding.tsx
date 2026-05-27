import Image from "next/image";
import Link from "next/link";
import { Search, Store, ArrowRight, Car } from "lucide-react";
import { searchMarketplaceVehicles, listMarketplaceTenants } from "@/lib/marketplace";
import { MarketplaceVehicleCard } from "@/components/marketplace/MarketplaceVehicleCard";

/**
 * Home da AutoStand voltada ao **comprador** — a porta de entrada do
 * marketplace. O acesso do lojista fica em /anuncie.
 */
export async function MarketplaceLanding() {
  const [{ vehicles, total }, lojas] = await Promise.all([
    searchMarketplaceVehicles({}),
    listMarketplaceTenants(),
  ]);
  const featured = vehicles.slice(0, 8);
  const mosaic = vehicles.filter((v) => v.primary_photo_url).slice(0, 4);
  const cityCount = new Set(
    vehicles.map((v) => v.loja.city).filter((c): c is string => Boolean(c)),
  ).size;

  return (
    <>
      {/* Hero — editorial premium */}
      <section className="relative overflow-hidden bg-sand">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-[5fr_7fr] lg:gap-16 lg:py-24">
          {/* Coluna texto */}
          <div className="max-w-xl">
            <p className="text-eyebrow uppercase text-signal">
              Marketplace · seminovos com procedência
            </p>
            <h1 className="mt-4 font-display text-h1 font-semibold leading-[1.05] text-ink lg:text-display">
              Encontre o seu{" "}
              <span className="block text-ink">próximo carro</span>
            </h1>
            <p className="mt-5 max-w-lg text-body-l text-n700">
              Veículos de concessionárias multimarca selecionadas, num só lugar.
              Sem atravessador, sem anúncio fantasma.
            </p>

            {/* Busca secundária — não é a peça principal */}
            <form action="/comprar" method="get" className="mt-7 flex max-w-md gap-2">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-n500"
                  aria-hidden
                />
                <input
                  type="text"
                  name="search"
                  placeholder="Marca, modelo ou versão"
                  className="h-11 w-full rounded-md border border-n300 bg-white pl-10 pr-3 text-body-s text-ink placeholder-n500 outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/20"
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-md bg-signal px-5 text-body-s font-medium text-ink shadow-xs transition-colors duration-150 hover:bg-signal-dark"
              >
                Buscar
              </button>
            </form>

            {/* Stats rápidos pra dar prova social */}
            {total > 0 && (
              <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-body-s">
                <Stat label="veículos disponíveis" value={total} />
                <Stat label={lojas.length === 1 ? "concessionária" : "concessionárias"} value={lojas.length} />
                {cityCount > 0 && (
                  <Stat label={cityCount === 1 ? "cidade" : "cidades"} value={cityCount} />
                )}
              </dl>
            )}
          </div>

          {/* Mosaico de fotos reais do estoque */}
          <div className="relative">
            <HeroMosaic items={mosaic} />
          </div>
        </div>
      </section>

      {/* Veículos em destaque */}
      <section className="bg-n50 px-5 py-16 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-eyebrow uppercase text-n500">Em destaque</p>
              <h2 className="mt-1 font-display text-h2 font-semibold text-ink">
                Veículos disponíveis agora
              </h2>
            </div>
            <Link
              href="/comprar"
              className="inline-flex shrink-0 items-center gap-1 text-body-s font-medium text-ink transition-colors hover:text-n700"
            >
              Ver todos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {featured.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-n300 bg-white px-6 py-16 text-center">
              <p className="text-body-s text-n500">
                Em breve, veículos das concessionárias da rede aparecem aqui.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((v) => (
                <MarketplaceVehicleCard key={v.id} vehicle={v} />
              ))}
            </div>
          )}

          {total > featured.length && (
            <div className="mt-10 text-center">
              <Link
                href="/comprar"
                className="inline-block rounded-md bg-ink px-6 py-3 text-body-s font-medium text-white shadow-xs transition-colors hover:bg-ink-700"
              >
                Ver os {total} veículos
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Concessionárias */}
      <section className="px-5 py-16">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="text-eyebrow uppercase text-n500">Lojas da rede</p>
            <h2 className="mt-1 font-display text-h3 font-semibold text-ink">
              Compre de concessionárias de verdade
            </h2>
            <p className="mt-1 text-body-s text-n600">
              Cada anúncio é de uma loja com endereço, contato e reputação.
            </p>
          </div>
          <Link
            href="/lojas"
            className="inline-flex shrink-0 items-center gap-2 rounded-md border border-n300 bg-white px-5 py-3 text-body-s font-medium text-ink transition-colors hover:border-n400 hover:bg-n50"
          >
            <Store className="h-4 w-4" />
            Ver concessionárias
          </Link>
        </div>
      </section>

      {/* Anuncie sua loja — porta do lojista */}
      <section className="bg-ink px-5 py-14">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="text-eyebrow uppercase text-signal">Para concessionárias</p>
            <h2 className="mt-1 font-display text-h3 font-semibold text-white">
              Tem uma loja de seminovos?
            </h2>
            <p className="mt-1 text-body-s text-n300">
              Site próprio, painel de gestão e o seu estoque no marketplace AutoStand.
            </p>
          </div>
          <Link
            href="/anuncie"
            className="shrink-0 rounded-md bg-signal px-6 py-3 text-body-s font-medium text-ink shadow-xs transition-colors hover:bg-signal-dark"
          >
            Anuncie sua loja
          </Link>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="sr-only">{label}</dt>
      <dd className="font-display text-h3 font-semibold text-ink">{value}</dd>
      <span aria-hidden className="text-body-s text-n600">{label}</span>
    </div>
  );
}

/**
 * Mosaico 2×2 assimétrico — foto principal grande à esquerda, três
 * menores empilhadas à direita. Em telas pequenas vira grade 2×2 simples.
 */
function HeroMosaic({ items }: { items: { id: number; primary_photo_url: string | null; brand: string; model: string }[] }) {
  // Fallback: nenhum veículo ainda — desenho ilustrativo respeitando a mesma proporção.
  if (items.length === 0) {
    return (
      <div className="grid aspect-[7/5] grid-cols-2 gap-3 lg:aspect-auto lg:h-[420px]">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center justify-center rounded-xl bg-ink/[0.06]"
          >
            <Car className="h-10 w-10 text-n400" aria-hidden />
          </div>
        ))}
      </div>
    );
  }

  const [first, ...rest] = items;
  return (
    <div className="grid aspect-[7/5] grid-cols-2 grid-rows-3 gap-3 lg:aspect-auto lg:h-[460px]">
      {/* Foto principal — ocupa 2 colunas em mobile, 1 col × 3 rows em desktop */}
      <MosaicTile
        vehicle={first}
        className="col-span-2 row-span-2 lg:col-span-1 lg:row-span-3"
        priority
      />
      {/* Até 3 fotos menores */}
      {rest.slice(0, 3).map((v, i) => (
        <MosaicTile
          key={v.id}
          vehicle={v}
          // No mobile a foto principal já ocupa 2 colunas em row-span-2;
          // os 3 menores entram nas 3 últimas células da grade 2×3.
          className={
            i === 0
              ? "col-span-1 row-start-3 lg:col-start-2 lg:row-start-1 lg:row-span-1"
              : i === 1
              ? "col-span-1 row-start-3 lg:col-start-2 lg:row-start-2 lg:row-span-1"
              : "col-span-2 row-start-4 hidden lg:col-start-2 lg:row-start-3 lg:row-span-1 lg:col-span-1 lg:block"
          }
        />
      ))}
    </div>
  );
}

function MosaicTile({
  vehicle,
  className,
  priority,
}: {
  vehicle: { primary_photo_url: string | null; brand: string; model: string };
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-n100 ${className ?? ""}`}>
      {vehicle.primary_photo_url ? (
        <Image
          src={vehicle.primary_photo_url}
          alt={`${vehicle.brand} ${vehicle.model}`}
          fill
          sizes="(max-width: 1024px) 50vw, 30vw"
          className="object-cover"
          priority={priority}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-n400">
          <Car className="h-10 w-10" aria-hidden />
        </div>
      )}
    </div>
  );
}
