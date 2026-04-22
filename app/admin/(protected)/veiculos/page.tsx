import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil } from "lucide-react";
import { listVehicles } from "@/lib/db";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatBRL } from "@/lib/money";

export const dynamic = "force-dynamic";

export default function VeiculosPage() {
  const vehicles = listVehicles();

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Veículos</h1>
          <p className="text-sm text-slate-500 mt-1">{vehicles.length} cadastrados</p>
        </div>
        <Link
          href="/admin/veiculos/novo"
          className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo veículo
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {["Veículo", "Ano / KM", "Custo", "Venda", "Margem", "Status", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {vehicles.map(v => (
              <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-9 rounded-md overflow-hidden bg-slate-100 flex-shrink-0 relative">
                      {v.primary_photo_url ? (
                        <Image src={v.primary_photo_url} alt="" fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">PI</div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{v.brand} {v.model}</p>
                      <p className="text-xs text-slate-400">{v.color} · {v.doors}p</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                  <p>{v.year}</p>
                  <p className="text-xs text-slate-400">{v.km.toLocaleString("pt-BR")} km</p>
                </td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatBRL(v.cost_price)}</td>
                <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{formatBRL(v.sale_price)}</td>
                <td className={`px-4 py-3 whitespace-nowrap font-medium ${v.sale_price - v.cost_price >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatBRL(v.sale_price - v.cost_price)}
                </td>
                <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/veiculos/${v.id}`}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {vehicles.length === 0 && (
          <div className="py-16 text-center text-slate-400">
            <p className="font-medium">Nenhum veículo cadastrado</p>
            <Link href="/admin/veiculos/novo" className="mt-3 inline-block text-sm text-blue-600 hover:text-blue-700">
              Adicionar primeiro veículo →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
