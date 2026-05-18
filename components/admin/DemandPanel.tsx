import { Search, Eye } from "lucide-react";
import { BODY_TYPE_LABELS } from "@/lib/constants";
import type { BodyType } from "@/lib/constants";
import type { DemandSnapshot, RankItem } from "@/lib/demand";

function RankList({
  title,
  items,
  transform,
}: {
  title: string;
  items: RankItem[];
  transform?: (label: string) => string;
}) {
  const max = items.reduce((m, i) => Math.max(m, i.count), 0) || 1;
  return (
    <div className="rounded-xl border border-n100 bg-white p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-n500">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-xs text-n400">Sem dados ainda</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {items.map((it) => (
            <li key={it.label}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-ink">{transform ? transform(it.label) : it.label}</span>
                <span className="shrink-0 text-xs text-n500">{it.count}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-n100">
                <div
                  className="h-1.5 rounded-full bg-signal"
                  style={{ width: `${Math.round((it.count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface Props {
  title: string;
  subtitle: string;
  snapshot: DemandSnapshot;
}

/** Painel de demanda — rankings de um snapshot (marketplace ou loja). */
export function DemandPanel({ title, subtitle, snapshot }: Props) {
  const empty = snapshot.totalSearches === 0 && snapshot.totalViews === 0;
  const bodyLabel = (k: string) => BODY_TYPE_LABELS[k as BodyType] ?? k;

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="text-xs text-n500">{subtitle}</p>
      </div>

      {empty ? (
        <div className="rounded-xl border border-dashed border-n300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-ink">Ainda sem dados suficientes</p>
          <p className="mt-1 text-xs text-n500">
            Os sinais aparecem conforme as buscas e visualizações acontecem.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-n50 px-3 py-1.5 text-sm text-n600">
              <Search className="h-3.5 w-3.5 text-n400" />
              {snapshot.totalSearches} buscas
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-n50 px-3 py-1.5 text-sm text-n600">
              <Eye className="h-3.5 w-3.5 text-n400" />
              {snapshot.totalViews} visualizações
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <RankList title="Marcas mais buscadas" items={snapshot.topBrands} />
            <RankList title="Faixas de preço procuradas" items={snapshot.priceBuckets} />
            <RankList title="Carrocerias buscadas" items={snapshot.topBodyTypes} transform={bodyLabel} />
            <RankList title="Veículos mais vistos" items={snapshot.mostViewed} />
            <RankList title="Cidades" items={snapshot.topCities} />
          </div>
        </>
      )}
    </section>
  );
}
