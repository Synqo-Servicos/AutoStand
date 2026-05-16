import Link from "next/link";
import { Building2, Car, CheckCircle2, PauseCircle, Plus, Users } from "lucide-react";
import { getPlatformStats, listTenantsWithStats } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SuperAdminDashboard() {
  const stats = await getPlatformStats();
  const tenants = await listTenantsWithStats();
  const recent = tenants.slice(0, 6);

  const tiles = [
    { label: "Concessionárias", value: stats.totalTenants, icon: Building2, tone: "bg-signal/10 text-signal" },
    { label: "Ativas", value: stats.activeTenants, icon: CheckCircle2, tone: "bg-success/12 text-success" },
    { label: "Suspensas", value: stats.suspendedTenants, icon: PauseCircle, tone: "bg-warning/12 text-warning" },
    { label: "Veículos na plataforma", value: stats.totalVehicles, icon: Car, tone: "bg-signal/10 text-signal" },
    { label: "Leads na plataforma", value: stats.totalLeads, icon: Users, tone: "bg-signal/10 text-signal" },
  ];

  return (
    <div className="p-8 max-w-6xl">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-signal via-signal to-signal-dark px-7 py-8 mb-8">
        <div className="relative">
          <p className="text-sand text-xs font-semibold uppercase tracking-widest mb-1">
            Console da plataforma
          </p>
          <h1 className="text-2xl font-bold text-white">Visão geral</h1>
          <p className="text-sand text-sm mt-1 max-w-lg">
            Gerencie todas as concessionárias clientes, seus domínios e identidade visual.
          </p>
          <Link
            href="/superadmin/tenants/novo"
            className="mt-5 inline-flex items-center gap-2 bg-white text-signal text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-signal/10 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova concessionária
          </Link>
        </div>
        <Building2 className="absolute -right-6 -bottom-8 w-44 h-44 text-white/5" />
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {tiles.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="bg-white rounded-xl border border-n200/70 p-5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${tone}`}>
              <Icon className="w-4.5 h-4.5" />
            </div>
            <p className="text-2xl font-bold text-ink">{value}</p>
            <p className="text-xs text-n600 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent tenants */}
      <div className="bg-white rounded-xl border border-n200/70 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-n100">
          <h2 className="text-sm font-semibold text-ink">Concessionárias recentes</h2>
          <Link href="/superadmin/tenants" className="text-xs font-medium text-signal hover:text-signal-dark">
            Ver todas →
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-n600">Nenhuma concessionária cadastrada</p>
            <Link
              href="/superadmin/tenants/novo"
              className="mt-3 inline-block text-sm text-signal hover:text-signal-dark"
            >
              Cadastrar a primeira →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-n100">
            {recent.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/superadmin/tenants/${t.id}`}
                  className="flex items-center gap-4 px-6 py-3.5 hover:bg-n50 transition-colors"
                >
                  <span
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: t.primary_color }}
                  >
                    {t.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">{t.name}</p>
                    <p className="text-xs text-n400 truncate">
                      {t.custom_domain ?? `${t.slug}.localhost`}
                    </p>
                  </div>
                  <span className="text-xs text-n400 hidden sm:block">{t.vehicle_count} veículos</span>
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      t.status === "active"
                        ? "bg-success/12 text-ink"
                        : "bg-warning/12 text-ink"
                    }`}
                  >
                    {t.status === "active" ? "Ativa" : "Suspensa"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
