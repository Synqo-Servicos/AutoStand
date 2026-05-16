import { getDashboardStats } from "@/lib/db";
import { getAdminTenant } from "@/lib/tenant";
import { DashboardCard } from "@/components/admin/DashboardCard";
import { MonthlyTable } from "@/components/admin/MonthlyTable";
import { formatBRL } from "@/lib/money";
import { STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const tenant = await getAdminTenant();
  const stats = await getDashboardStats(tenant.id);
  const disponivel = stats.stockByStatus.find(s => s.status === "disponivel")?.count ?? 0;
  const reservado  = stats.stockByStatus.find(s => s.status === "reservado")?.count ?? 0;
  const vendido    = stats.stockByStatus.find(s => s.status === "vendido")?.count ?? 0;
  const total      = disponivel + reservado + vendido;

  const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const now = new Date();
  const mes = `${MONTH_NAMES[now.getMonth()]}/${String(now.getFullYear()).slice(2)}`;

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
        <p className="text-sm text-n600 mt-1">Visão geral do mês de {mes}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <DashboardCard label="Vendas este mês" value={String(stats.monthlySales.units)} sub="unidades vendidas" accent />
        <DashboardCard label="Receita este mês" value={formatBRL(stats.monthlySales.revenue)} sub="valor total das vendas" />
        <DashboardCard label="Lucro bruto do mês" value={formatBRL(stats.monthlyProfit)} sub="receita menos custo" />
        <DashboardCard label="Valor do estoque" value={formatBRL(stats.totalCostValue)} sub="custo total dos disponíveis" />
      </div>

      {/* Stock */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-n100 p-4 text-center">
          <p className="text-3xl font-bold text-ink">{disponivel}</p>
          <p className="text-xs text-n600 mt-1">{STATUS_LABELS.disponivel}</p>
        </div>
        <div className="bg-white rounded-xl border border-n100 p-4 text-center">
          <p className="text-3xl font-bold text-ink">{reservado}</p>
          <p className="text-xs text-n600 mt-1">{STATUS_LABELS.reservado}</p>
        </div>
        <div className="bg-white rounded-xl border border-n100 p-4 text-center">
          <p className="text-3xl font-bold text-n600">{vendido}</p>
          <p className="text-xs text-n600 mt-1">{STATUS_LABELS.vendido} (total)</p>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-n100 p-4 mb-8 text-center">
        <p className="text-3xl font-bold text-ink">{total}</p>
        <p className="text-xs text-n600 mt-1">Veículos cadastrados (total)</p>
      </div>

      {/* Monthly table */}
      <div className="bg-white rounded-xl border border-n100 overflow-hidden">
        <div className="px-6 py-4 border-b border-n100">
          <h2 className="text-sm font-semibold text-ink">Histórico mensal</h2>
        </div>
        <MonthlyTable data={stats.monthly} />
      </div>
    </div>
  );
}
