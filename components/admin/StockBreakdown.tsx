import { STATUS_LABELS } from "@/lib/constants";

interface Props {
  disponivel: number;
  reservado: number;
  vendido: number;
}

/**
 * Stacked bar horizontal mostrando a composição do estoque por status,
 * com legenda abaixo. Substitui as 3 caixas chapadas idênticas que não
 * passavam proporção visual entre Disponível/Reservado/Vendido.
 */
export function StockBreakdown({ disponivel, reservado, vendido }: Props) {
  const total = disponivel + reservado + vendido;

  const segments = [
    {
      key: "disponivel" as const,
      label: STATUS_LABELS.disponivel,
      count: disponivel,
      barClass: "bg-success",
      dotClass: "bg-success",
    },
    {
      key: "reservado" as const,
      label: STATUS_LABELS.reservado,
      count: reservado,
      barClass: "bg-warning",
      dotClass: "bg-warning",
    },
    {
      key: "vendido" as const,
      label: STATUS_LABELS.vendido,
      count: vendido,
      barClass: "bg-n400",
      dotClass: "bg-n400",
    },
  ];

  return (
    <section className="rounded-xl border border-n200 bg-white p-6 shadow-xs">
      <header className="flex items-baseline justify-between gap-4 mb-5">
        <div>
          <p className="text-eyebrow uppercase text-n500">Estoque</p>
          <p className="mt-1 font-display text-h2 font-semibold text-ink tabular-nums">
            {total}
          </p>
          <p className="text-body-s text-n600">
            {total === 1 ? "veículo cadastrado" : "veículos cadastrados"}
          </p>
        </div>
      </header>

      {/* Barra empilhada — segmentos com largura proporcional */}
      <div
        role="img"
        aria-label={`Composição do estoque: ${segments
          .filter((s) => s.count > 0)
          .map((s) => `${s.count} ${s.label.toLowerCase()}`)
          .join(", ") || "vazio"}`}
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-n100"
      >
        {total > 0 &&
          segments
            .filter((s) => s.count > 0)
            .map((s) => (
              <span
                key={s.key}
                className={`${s.barClass} transition-[width] duration-300`}
                style={{ width: `${(s.count / total) * 100}%` }}
              />
            ))}
      </div>

      {/* Legenda */}
      <ul className="mt-5 grid grid-cols-3 gap-3 text-body-s">
        {segments.map((s) => {
          const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
          return (
            <li key={s.key} className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${s.dotClass}`} aria-hidden />
                <span className="truncate text-n600">{s.label}</span>
              </div>
              <p className="mt-1 font-display text-h3 font-semibold text-ink tabular-nums">
                {s.count}
              </p>
              <p className="text-[11px] text-n500">{pct}% do estoque</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
