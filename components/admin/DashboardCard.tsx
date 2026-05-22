interface Props {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}

export function DashboardCard({ label, value, sub, accent }: Props) {
  return (
    <div className={`rounded-xl border p-5 bg-white ${accent ? "border-signal ring-1 ring-signal" : "border-n100"}`}>
      <p className="text-xs font-medium text-n600 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl sm:text-2xl font-semibold tabular-nums ${accent ? "text-signal" : "text-ink"}`}>{value}</p>
      {sub && <p className="text-xs text-n400 mt-1">{sub}</p>}
    </div>
  );
}
