import Link from "next/link";
import { ExternalLink, Pencil, Plus } from "lucide-react";
import { listTenantsWithStats } from "@/lib/db";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const tenants = await listTenantsWithStats();

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="font-display text-h1 font-semibold text-ink">Concessionárias</h1>
          <p className="text-body-s text-n600 mt-1">
            {tenants.length} {tenants.length === 1 ? "cadastrada" : "cadastradas"}
          </p>
        </div>
        <Link
          href="/superadmin/tenants/novo"
          className="inline-flex items-center gap-2 bg-signal text-ink text-body-s font-medium px-4 py-2.5 rounded-md shadow-xs transition-colors hover:bg-signal-dark"
        >
          <Plus className="w-4 h-4" />
          Nova concessionária
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-n200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-n100 text-sm">
          <thead>
            <tr className="bg-n50">
              {["Concessionária", "Domínio", "Estoque", "Leads", "Status", ""].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-eyebrow text-n600"
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
                      <p className="text-xs text-n500">/{t.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-n700 whitespace-nowrap">
                  {t.custom_domain ? (
                    <span className="inline-flex items-center gap-1">
                      {t.custom_domain}
                      <ExternalLink className="w-3 h-3 text-n500" />
                    </span>
                  ) : (
                    <span className="text-n500">— não configurado</span>
                  )}
                </td>
                <td className="px-4 py-3 text-n700 tabular-nums">{t.vehicle_count}</td>
                <td className="px-4 py-3 text-n700 tabular-nums">{t.lead_count}</td>
                <td className="px-4 py-3">
                  <Badge
                    tone={t.status === "active" ? "available" : "pending"}
                    dot
                    size="sm"
                  >
                    {t.status === "active" ? "Ativa" : "Suspensa"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/superadmin/tenants/${t.id}`}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-n200 text-n700 transition-colors hover:border-n400 hover:bg-n50 hover:text-ink"
                  >
                    <Pencil className="w-3 h-3" />
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {tenants.length === 0 && (
          <div className="py-16 text-center">
            <p className="font-medium text-ink">Nenhuma concessionária cadastrada</p>
            <p className="mt-1 text-body-s text-n600">
              Cadastre a primeira loja cliente para começar.
            </p>
            <Link
              href="/superadmin/tenants/novo"
              className="mt-4 inline-block text-body-s font-medium text-signal hover:text-signal-dark"
            >
              Cadastrar a primeira →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
