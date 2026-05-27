import Link from "next/link";
import { Building2, Car, CheckCircle2, PauseCircle, Plus, Users, ArrowRight } from "lucide-react";
import { getPlatformStats, listTenantsWithStats } from "@/lib/db";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SuperAdminDashboard() {
  const stats = await getPlatformStats();
  const tenants = await listTenantsWithStats();
  const recent = tenants.slice(0, 6);

  // Tons aplicados conforme regra do SPEC §1.3: signal só em
  // CTAs primários e dados-destaque (Concessionárias, KPI principal
  // do console). Demais KPIs em tons neutros (ink/n) ou de status
  // (success/warning) — laranja deixa de ser pintura decorativa.
  const tiles: {
    label: string;
    value: number;
    icon: typeof Building2;
    iconBg: string;
    iconColor: string;
  }[] = [
    {
      label: "Concessionárias",
      value: stats.totalTenants,
      icon: Building2,
      iconBg: "bg-signal/10",
      iconColor: "text-signal",
    },
    {
      label: "Ativas",
      value: stats.activeTenants,
      icon: CheckCircle2,
      iconBg: "bg-success/12",
      iconColor: "text-success-dark",
    },
    {
      label: "Suspensas",
      value: stats.suspendedTenants,
      icon: PauseCircle,
      iconBg: "bg-warning/15",
      iconColor: "text-warning-dark",
    },
    {
      label: "Veículos na plataforma",
      value: stats.totalVehicles,
      icon: Car,
      iconBg: "bg-ink/8",
      iconColor: "text-ink",
    },
    {
      label: "Leads na plataforma",
      value: stats.totalLeads,
      icon: Users,
      iconBg: "bg-ink/8",
      iconColor: "text-ink",
    },
  ];

  return (
    <div className="p-8 max-w-6xl">
      {/* Hero — console sóbrio: bg-ink + accent signal só no eyebrow/CTA */}
      <section className="relative overflow-hidden rounded-2xl bg-ink px-7 py-8 mb-8">
        <div className="relative max-w-lg">
          <p className="text-eyebrow uppercase text-signal">
            Console da plataforma
          </p>
          <h1 className="mt-3 font-display text-h1 font-semibold text-white leading-tight">
            Visão geral
          </h1>
          <p className="mt-3 text-body-s text-n300">
            Gerencie as concessionárias clientes, seus domínios e identidade visual.
          </p>
          <Link
            href="/superadmin/tenants/novo"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-signal px-4 py-2.5 text-body-s font-medium text-ink shadow-xs transition-colors hover:bg-signal-dark"
          >
            <Plus className="w-4 h-4" />
            Nova concessionária
          </Link>
        </div>
        <Building2
          className="absolute -right-6 -bottom-8 w-44 h-44 text-white/[0.04]"
          aria-hidden
        />
      </section>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {tiles.map(({ label, value, icon: Icon, iconBg, iconColor }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-n200 p-5 shadow-xs"
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${iconBg} ${iconColor}`}
            >
              <Icon className="w-4.5 h-4.5" aria-hidden />
            </div>
            <p className="font-display text-h2 font-semibold text-ink tabular-nums">
              {value}
            </p>
            <p className="text-body-s text-n600 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent tenants */}
      <section className="bg-white rounded-xl border border-n200 overflow-hidden shadow-xs">
        <header className="flex items-center justify-between px-6 py-4 border-b border-n100">
          <h2 className="text-body-s font-semibold text-ink">Concessionárias recentes</h2>
          <Link
            href="/superadmin/tenants"
            className="inline-flex items-center gap-1 text-body-s font-medium text-ink transition-colors hover:text-n700"
          >
            Ver todas
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </header>
        {recent.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-body-s font-medium text-ink">Nenhuma concessionária cadastrada</p>
            <Link
              href="/superadmin/tenants/novo"
              className="mt-3 inline-block text-body-s font-medium text-signal hover:text-signal-dark"
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
                    <p className="text-body-s font-medium text-ink truncate">{t.name}</p>
                    <p className="text-[11px] text-n500 truncate">
                      {t.custom_domain ?? `${t.slug}.autostand.com.br`}
                    </p>
                  </div>
                  <span className="text-[11px] text-n500 hidden sm:block">
                    {t.vehicle_count} veículos
                  </span>
                  <Badge
                    tone={t.status === "active" ? "available" : "pending"}
                    dot
                    size="sm"
                  >
                    {t.status === "active" ? "Ativa" : "Suspensa"}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
