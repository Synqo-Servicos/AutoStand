import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil } from "lucide-react";
import { listVehicles } from "@/lib/db";
import { getAdminTenant } from "@/lib/tenant";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatBRL } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function VeiculosPage() {
  const tenant = await getAdminTenant();
  const vehicles = await listVehicles(tenant.id);

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Veículos</h1>
          <p className="text-sm text-n600 mt-1">{vehicles.length} cadastrados</p>
        </div>
        <Link
          href="/admin/veiculos/novo"
          className="inline-flex items-center gap-2 bg-signal text-ink text-sm font-medium px-4 py-2 rounded-lg hover:bg-signal-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo veículo
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-n100 overflow-hidden">
        <table className="min-w-full divide-y divide-n100 text-sm">
          <thead>
            <tr className="bg-n50 border-b border-n200">
              {["Veículo", "Ano / KM", "Custo", "Venda", "Margem", "Status", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-n600 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-n100">
            {vehicles.map(v => (
              <tr key={v.id} className="hover:bg-n50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-9 rounded-md overflow-hidden bg-n100 flex-shrink-0 relative">
                      {v.primary_photo_url ? (
                        <Image src={v.primary_photo_url} alt="" fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-n400 text-xs">PI</div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-ink">{v.brand} {v.model}</p>
                      <p className="text-xs text-n400">{v.color} · {v.doors}p</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-n600 whitespace-nowrap">
                  <p>{v.year}</p>
                  <p className="text-xs text-n400">{v.km.toLocaleString("pt-BR")} km</p>
                </td>
                <td className="px-4 py-3 text-n600 whitespace-nowrap">{formatBRL(v.cost_price)}</td>
                <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">{formatBRL(v.sale_price)}</td>
                <td className={`px-4 py-3 whitespace-nowrap font-medium ${v.sale_price - v.cost_price >= 0 ? "text-ink" : "text-danger"}`}>
                  {formatBRL(v.sale_price - v.cost_price)}
                </td>
                <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/veiculos/${v.id}`}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-n200 text-n600 hover:border-signal hover:text-signal hover:bg-signal/10 transition-colors"
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
          <div className="py-16 text-center text-n400">
            <p className="font-medium">Nenhum veículo cadastrado</p>
            <Link href="/admin/veiculos/novo" className="mt-3 inline-block text-sm text-signal hover:text-signal-dark">
              Adicionar primeiro veículo →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
