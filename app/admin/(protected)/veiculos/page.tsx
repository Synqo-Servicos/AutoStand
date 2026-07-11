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
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
        <div className="min-w-0">
          <h1 className="font-display text-h2 font-semibold text-ink">Veículos</h1>
          <p className="text-sm text-n600 mt-1">{vehicles.length} cadastrados</p>
        </div>
        <Link
          href="/admin/veiculos/novo"
          className="inline-flex items-center gap-1.5 bg-signal text-ink text-sm font-medium px-3 sm:px-4 py-2 rounded-lg hover:bg-signal-dark transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Novo veículo</span>
          <span className="sm:hidden">Novo</span>
        </Link>
      </div>

      {vehicles.length === 0 ? (
        <div className="bg-white rounded-xl border border-n200 py-16 text-center text-n500">
          <p className="font-medium text-ink">Nenhum veículo cadastrado</p>
          <p className="mt-1 text-body-s text-n600">Adicione seu primeiro veículo para começar.</p>
          <Link href="/admin/veiculos/novo" className="mt-4 inline-block text-sm font-medium text-signal hover:text-signal-dark">
            Adicionar primeiro veículo →
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="hidden md:block bg-white rounded-xl border border-n100 overflow-hidden">
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
                {vehicles.map(v => {
                  const margin = v.sale_price - v.cost_price;
                  return (
                    <tr key={v.id} className="hover:bg-n50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-9 rounded-md overflow-hidden bg-n100 flex-shrink-0 relative">
                            {v.primary_photo_url ? (
                              <Image src={v.primary_photo_url} alt="" fill className="object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-n500 text-[10px] font-medium">FOTO</div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-ink">{v.brand} {v.model}</p>
                            <p className="text-xs text-n600">{v.color} · {v.doors}p</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-n600 whitespace-nowrap">
                        <p>{v.year}</p>
                        <p className="text-xs text-n600">{v.km.toLocaleString("pt-BR")} km</p>
                      </td>
                      <td className="px-4 py-3 text-n600 whitespace-nowrap">{formatBRL(v.cost_price)}</td>
                      <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">{formatBRL(v.sale_price)}</td>
                      <td className={`px-4 py-3 whitespace-nowrap font-medium ${margin >= 0 ? "text-ink" : "text-danger"}`}>
                        {formatBRL(margin)}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/veiculos/${v.id}`}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-n200 text-n700 transition-colors hover:border-n400 hover:bg-n50 hover:text-ink"
                        >
                          <Pencil className="w-3 h-3" />
                          Editar
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: lista de cards */}
          <ul className="md:hidden space-y-3">
            {vehicles.map((v) => {
              const margin = v.sale_price - v.cost_price;
              return (
                <li key={v.id}>
                  <Link
                    href={`/admin/veiculos/${v.id}`}
                    className="flex gap-3 bg-white rounded-xl border border-n100 p-3 active:bg-n50 transition-colors"
                  >
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-n100 relative shrink-0">
                      {v.primary_photo_url ? (
                        <Image src={v.primary_photo_url} alt="" fill className="object-cover" sizes="80px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-n500 text-xs">sem foto</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-ink truncate">{v.brand} {v.model}</p>
                          <p className="text-xs text-n600">
                            {v.year} · {v.km.toLocaleString("pt-BR")} km · {v.color}
                          </p>
                        </div>
                        <StatusBadge status={v.status} />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-ink tabular-nums">{formatBRL(v.sale_price)}</p>
                          <p className={`text-xs tabular-nums ${margin >= 0 ? "text-n600" : "text-danger"}`}>
                            Margem {formatBRL(margin)}
                          </p>
                        </div>
                        <span className="text-xs text-signal font-medium whitespace-nowrap">
                          Editar →
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
