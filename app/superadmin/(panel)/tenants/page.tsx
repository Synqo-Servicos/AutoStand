import Link from "next/link";
import { Building2, ExternalLink, Pencil, Plus } from "lucide-react";
import { listTenantsWithStats } from "@/lib/db";
import { Badge, EmptyState } from "@/components/ui";

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

      {tenants.length === 0 ? (
        <div className="bg-white rounded-xl border border-n200 shadow-xs">
          <EmptyState
            icon={Building2}
            title="Nenhuma concessionária cadastrada"
            description="Cadastre a primeira loja cliente para começar."
            cta={
              <Link
                href="/superadmin/tenants/novo"
                className="text-body-s font-medium text-signal hover:text-signal-dark"
              >
                Cadastrar a primeira →
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="hidden md:block bg-white rounded-xl border border-n200 overflow-hidden shadow-xs">
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
          </div>

          {/* Mobile: lista de cards */}
          <ul className="md:hidden space-y-3">
            {tenants.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/superadmin/tenants/${t.id}`}
                  className="flex gap-3 bg-white rounded-xl border border-n200 shadow-xs p-3 active:bg-n50 transition-colors"
                >
                  <span
                    className="w-11 h-11 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: t.primary_color }}
                  >
                    {t.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink truncate">{t.name}</p>
                        <p className="text-xs text-n500">/{t.slug}</p>
                      </div>
                      <Badge
                        tone={t.status === "active" ? "available" : "pending"}
                        dot
                        size="sm"
                      >
                        {t.status === "active" ? "Ativa" : "Suspensa"}
                      </Badge>
                    </div>
                    {t.custom_domain && (
                      <p className="mt-1 text-xs text-n500 inline-flex items-center gap-1 truncate">
                        {t.custom_domain}
                        <ExternalLink className="w-3 h-3 text-n500 shrink-0" />
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-n600 tabular-nums">
                        {t.vehicle_count} veículos · {t.lead_count} leads
                      </span>
                      <span className="text-xs text-signal font-medium whitespace-nowrap">
                        Editar →
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
