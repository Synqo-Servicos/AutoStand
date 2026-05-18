import Link from "next/link";
import { Search, Store, ArrowRight } from "lucide-react";
import { searchMarketplaceVehicles } from "@/lib/marketplace";
import { MarketplaceVehicleCard } from "@/components/marketplace/MarketplaceVehicleCard";

/**
 * Home da AutoStand voltada ao **comprador** — a porta de entrada do
 * marketplace. O acesso do lojista fica em /anuncie.
 */
export async function MarketplaceLanding() {
  const { vehicles, total } = await searchMarketplaceVehicles({});
  const featured = vehicles.slice(0, 8);

  return (
    <>
      {/* Hero — busca */}
      <section className="bg-ink px-5 py-20 text-white">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-eyebrow font-semibold uppercase text-signal">
            Seminovos com procedência
          </p>
          <h1 className="mt-4 font-display text-h1 font-bold leading-tight sm:text-[3.25rem]">
            Encontre seu próximo carro
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-body-l text-n400">
            Veículos de concessionárias multimarca selecionadas da rede AutoStand
            — num só lugar.
          </p>
          <form action="/comprar" method="get" className="mx-auto mt-8 flex max-w-xl gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-n400" />
              <input
                type="text"
                name="search"
                placeholder="Marca, modelo ou versão"
                className="w-full rounded-lg border border-white/15 bg-white/10 py-3 pl-11 pr-3 text-white placeholder-n400 outline-none focus:border-signal"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-signal px-6 py-3 font-semibold text-ink transition-colors hover:bg-signal-dark"
            >
              Buscar
            </button>
          </form>
        </div>
      </section>

      {/* Veículos em destaque */}
      <section className="bg-n50 px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-eyebrow font-semibold uppercase text-signal">Em destaque</p>
              <h2 className="mt-1 font-display text-h2 font-semibold text-ink">
                Veículos disponíveis agora
              </h2>
            </div>
            <Link
              href="/comprar"
              className="inline-flex shrink-0 items-center gap-1 text-body-s font-semibold text-ink hover:text-signal"
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
            <div className="mt-8 text-center">
              <Link
                href="/comprar"
                className="inline-block rounded-lg bg-ink px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90"
              >
                Ver os {total} veículos
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Concessionárias */}
      <section className="px-5 py-16">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="text-eyebrow font-semibold uppercase text-signal">Lojas da rede</p>
            <h2 className="mt-1 font-display text-h3 font-semibold text-ink">
              Compre de concessionárias de verdade
            </h2>
            <p className="mt-1 text-body-s text-n600">
              Cada anúncio é de uma loja com endereço, contato e reputação.
            </p>
          </div>
          <Link
            href="/lojas"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-n300 px-5 py-3 font-semibold text-ink transition-colors hover:bg-n50"
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
            <p className="text-eyebrow font-semibold uppercase text-signal">Para concessionárias</p>
            <h2 className="mt-1 font-display text-h3 font-semibold text-white">
              Tem uma loja de seminovos?
            </h2>
            <p className="mt-1 text-body-s text-n400">
              Site próprio, painel de gestão e o seu estoque no marketplace AutoStand.
            </p>
          </div>
          <Link
            href="/anuncie"
            className="shrink-0 rounded-lg bg-signal px-6 py-3 font-semibold text-ink transition-colors hover:bg-signal-dark"
          >
            Anuncie sua loja
          </Link>
        </div>
      </section>
    </>
  );
}
