import { getDashboardStats } from "@/lib/db";
import { getAdminTenant } from "@/lib/tenant";
import { DashboardCard } from "@/components/admin/DashboardCard";
import { MonthlyTable } from "@/components/admin/MonthlyTable";
import { StockBreakdown } from "@/components/admin/StockBreakdown";
import { formatBRL } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const tenant = await getAdminTenant();
  const stats = await getDashboardStats(tenant.id);
  const disponivel = stats.stockByStatus.find(s => s.status === "disponivel")?.count ?? 0;
  const reservado  = stats.stockByStatus.find(s => s.status === "reservado")?.count ?? 0;
  const vendido    = stats.stockByStatus.find(s => s.status === "vendido")?.count ?? 0;

  const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const now = new Date();
  const mes = `${MONTH_NAMES[now.getMonth()]}/${String(now.getFullYear()).slice(2)}`;

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
        <p className="text-sm text-n600 mt-1">Visão geral do mês de {mes}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <DashboardCard label="Vendas este mês" value={String(stats.monthlySales.units)} sub="unidades vendidas" accent />
        <DashboardCard label="Receita este mês" value={formatBRL(stats.monthlySales.revenue)} sub="valor total das vendas" />
        <DashboardCard label="Lucro bruto do mês" value={formatBRL(stats.monthlyProfit)} sub="receita menos custo" />
        <DashboardCard label="Valor do estoque" value={formatBRL(stats.totalCostValue)} sub="custo total dos disponíveis" />
      </div>

      {/* Estoque — stacked bar proporcional */}
      <div className="mb-6 sm:mb-8">
        <StockBreakdown disponivel={disponivel} reservado={reservado} vendido={vendido} />
      </div>

      {/* Monthly table */}
      <div className="bg-white rounded-xl border border-n100 overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-n100">
          <h2 className="text-sm font-semibold text-ink">Histórico mensal</h2>
        </div>
        <MonthlyTable data={stats.monthly} />
      </div>
    </div>
  );
}
