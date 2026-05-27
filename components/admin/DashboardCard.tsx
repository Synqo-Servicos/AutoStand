interface Props {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}

/**
 * KPI card do dashboard admin. `accent` destaca o card com bg tonal
 * + borda mais quente, sem duplicar com ring (a versão anterior tinha
 * border-signal + ring-1 ring-signal — duas linhas no mesmo lugar).
 */
export function DashboardCard({ label, value, sub, accent }: Props) {
  return (
    <div
      className={
        "rounded-xl border p-5 transition-colors " +
        (accent
          ? "border-signal/40 bg-signal/[0.04]"
          : "border-n200 bg-white")
      }
    >
      <p className="text-eyebrow uppercase text-n500 mb-1.5">{label}</p>
      <p
        className={
          "text-xl sm:text-2xl font-semibold tabular-nums font-display " +
          (accent ? "text-signal" : "text-ink")
        }
      >
        {value}
      </p>
      {sub && <p className="text-body-s text-n600 mt-1">{sub}</p>}
    </div>
  );
}
