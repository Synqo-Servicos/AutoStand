interface Props {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}

export function DashboardCard({ label, value, sub, accent }: Props) {
  return (
    <div className={`rounded-xl border p-5 bg-white ${accent ? "border-blue-200 ring-1 ring-blue-100" : "border-slate-100"}`}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${accent ? "text-blue-600" : "text-slate-900"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}
