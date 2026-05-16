import Link from "next/link";
import { ExternalLink, Pencil, Plus } from "lucide-react";
import { listTenantsWithStats } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const tenants = await listTenantsWithStats();

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Concessionárias</h1>
          <p className="text-sm text-n600 mt-1">{tenants.length} cadastradas</p>
        </div>
        <Link
          href="/superadmin/tenants/novo"
          className="inline-flex items-center gap-2 bg-signal text-ink text-sm font-medium px-4 py-2 rounded-lg hover:bg-signal-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova concessionária
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-n200/70 overflow-hidden">
        <table className="min-w-full divide-y divide-n100 text-sm">
          <thead>
            <tr className="bg-n50">
              {["Concessionária", "Domínio", "Estoque", "Leads", "Status", ""].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-n600 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-n100">
            {tenants.map((t) => (
              <tr key={t.id} className="hover:bg-n50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: t.primary_color }}
                    >
                      {t.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-medium text-ink">{t.name}</p>
                      <p className="text-xs text-n400">/{t.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-n600 whitespace-nowrap">
                  {t.custom_domain ? (
                    <span className="inline-flex items-center gap-1">
                      {t.custom_domain}
                      <ExternalLink className="w-3 h-3 text-n400" />
                    </span>
                  ) : (
                    <span className="text-n400">— não configurado</span>
                  )}
                </td>
                <td className="px-4 py-3 text-n600">{t.vehicle_count}</td>
                <td className="px-4 py-3 text-n600">{t.lead_count}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      t.status === "active"
                        ? "bg-success/12 text-ink ring-1 ring-success/30"
                        : "bg-warning/12 text-ink ring-1 ring-warning/30"
                    }`}
                  >
                    {t.status === "active" ? "Ativa" : "Suspensa"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/superadmin/tenants/${t.id}`}
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
        {tenants.length === 0 && (
          <div className="py-16 text-center text-n400">
            <p className="font-medium">Nenhuma concessionária cadastrada</p>
            <Link
              href="/superadmin/tenants/novo"
              className="mt-3 inline-block text-sm text-signal hover:text-signal-dark"
            >
              Cadastrar a primeira →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
