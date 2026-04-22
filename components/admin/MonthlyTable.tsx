import { formatBRL } from "@/lib/money";
import type { MonthlyData } from "@/types/dashboard";

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function formatMonth(m: string): string {
  const [year, month] = m.split("-");
  return `${MONTH_NAMES[parseInt(month) - 1]}/${year?.slice(2)}`;
}

export function MonthlyTable({ data }: { data: MonthlyData[] }) {
  if (!data.length) {
    return <p className="text-sm text-slate-400 text-center py-8">Nenhuma venda registrada ainda.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm divide-y divide-slate-100">
        <thead>
          <tr className="bg-slate-50">
            {["Mês", "Unidades", "Receita", "Lucro bruto"].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-100">
          {data.map(row => (
            <tr key={row.month} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 font-medium text-slate-900">{formatMonth(row.month)}</td>
              <td className="px-4 py-3 text-slate-600">{row.units}</td>
              <td className="px-4 py-3 text-slate-600">{formatBRL(row.revenue)}</td>
              <td className={`px-4 py-3 font-medium ${row.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {formatBRL(row.profit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
