import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Car, Download, Wallet } from "lucide-react";
import { getAdminTenant } from "@/lib/tenant";
import {
  getFinanceiroPorVeiculo,
  getFinanceiroResumo,
  getOperationalExpenses,
} from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { OperationalExpenseList } from "@/components/admin/OperationalExpenseList";

export const dynamic = "force-dynamic";

type Tab = "resumo" | "veiculos" | "operacionais";

type SearchParams = Promise<{ tab?: string; month?: string }>;

const TABS: { id: Tab; label: string }[] = [
  { id: "resumo",       label: "Resumo" },
  { id: "veiculos",     label: "Por veículo" },
  { id: "operacionais", label: "Despesas operacionais" },
];

export default async function FinanceiroPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const tab: Tab = TABS.some(t => t.id === sp.tab) ? (sp.tab as Tab) : "resumo";
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const month = (sp.month ?? defaultMonth).slice(0, 7);

  const tenant = await getAdminTenant();

  return (
    <div className="p-4 sm:p-8 max-w-6xl space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink">Financeiro</h1>
          <p className="text-sm text-n600 mt-1">
            Visão consolidada de receita, custos e margem da loja.
          </p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <a
            href={`/api/financeiro/export?month=${month}`}
            className="inline-flex items-center gap-1.5 border border-n200 text-ink text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-n50 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </a>
          <MonthPicker tab={tab} month={month} />
        </div>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-n100">
        {TABS.map(t => {
          const active = t.id === tab;
          const href = `/admin/financeiro?tab=${t.id}&month=${month}`;
          return (
            <Link
              key={t.id}
              href={href}
              className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                active
                  ? "bg-white text-ink border border-n100 border-b-white -mb-px"
                  : "text-n600 hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {tab === "resumo"       && <ResumoTab tenantId={tenant.id} month={month} />}
      {tab === "veiculos"     && <VeiculosTab tenantId={tenant.id} month={month} />}
      {tab === "operacionais" && <OperacionaisTab tenantId={tenant.id} month={month} />}
    </div>
  );
}

function MonthPicker({ tab, month }: { tab: Tab; month: string }) {
  return (
    <form className="flex items-center gap-2" action="/admin/financeiro" method="get">
      <input type="hidden" name="tab" value={tab} />
      <label className="text-xs text-n600">Período</label>
      <input
        type="month"
        name="month"
        defaultValue={month}
        className="border border-n200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-signal focus:border-transparent"
      />
      <button
        type="submit"
        className="px-3 py-1.5 text-xs font-medium bg-ink text-white rounded-lg hover:bg-ink/90 transition-colors cursor-pointer"
      >
        Aplicar
      </button>
    </form>
  );
}

async function ResumoTab({ tenantId, month }: { tenantId: number; month: string }) {
  const r = await getFinanceiroResumo(tenantId, { month });
  const margemPct = r.receita > 0 ? (r.lucroLiquido / r.receita) * 100 : 0;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={ArrowUpRight} label="Receita"        value={formatBRL(r.receita)} color="signal" />
        <Kpi icon={Car}          label="Veículos vendidos" value={String(r.vendasUnits)} color="ink" />
        <Kpi icon={ArrowDownRight} label="Despesas totais"
             value={formatBRL(r.despesasDir + r.despesasOp + r.custos)} color="danger" />
        <Kpi icon={Wallet}      label="Lucro líquido"
             value={`${formatBRL(r.lucroLiquido)} (${margemPct.toFixed(1)}%)`}
             color={r.lucroLiquido >= 0 ? "success" : "danger"} />
      </div>

      <section className="bg-white border border-n100 rounded-xl overflow-hidden">
        <header className="px-5 py-4 border-b border-n100">
          <h2 className="text-sm font-semibold text-ink">Composição do resultado</h2>
          <p className="text-xs text-n400 mt-0.5">Período: {month}</p>
        </header>
        <div className="divide-y divide-n100 text-sm">
          <Line label="Receita de vendas" value={formatBRL(r.receita)} />
          <Line label="Custo dos veículos vendidos" value={`− ${formatBRL(r.custos)}`} muted />
          <Line label="= Lucro bruto" value={formatBRL(r.lucroBruto)} bold />
          <Line label="Despesas diretas (preparação, reparos…)" value={`− ${formatBRL(r.despesasDir)}`} muted />
          <Line label="Despesas operacionais (estrutura, marketing, comissão)" value={`− ${formatBRL(r.despesasOp)}`} muted />
          <Line label="= Lucro líquido"
                value={`${formatBRL(r.lucroLiquido)} (${margemPct.toFixed(1)}%)`}
                bold
                highlight={r.lucroLiquido >= 0 ? "positive" : "negative"} />
        </div>
      </section>
    </div>
  );
}

async function VeiculosTab({ tenantId, month }: { tenantId: number; month: string }) {
  const rows = await getFinanceiroPorVeiculo(tenantId, { month });
  return (
    <section className="bg-white border border-n100 rounded-xl overflow-hidden">
      <header className="px-5 py-4 border-b border-n100">
        <h2 className="text-sm font-semibold text-ink">Margem real por veículo vendido</h2>
        <p className="text-xs text-n400 mt-0.5">
          Receita − custo − despesas diretas. Período: {month}.
        </p>
      </header>
      {rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-n400">
          Nenhum veículo vendido no período.
        </div>
      ) : (
        <table className="min-w-full text-sm">
          <thead className="bg-n50">
            <tr>
              <Th>Veículo</Th>
              <Th>Vendido em</Th>
              <Th align="right">Receita</Th>
              <Th align="right">Custo</Th>
              <Th align="right">Despesas</Th>
              <Th align="right">Margem real</Th>
              <Th align="right">%</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-n100">
            {rows.map((r) => {
              const pct = r.receita > 0 ? (r.margem_real / r.receita) * 100 : 0;
              return (
                <tr key={`${r.vehicle_id}-${r.sale_date}`} className="hover:bg-n50/60">
                  <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">
                    <Link href={`/admin/veiculos/${r.vehicle_id}`} className="hover:underline">
                      {r.brand} {r.model} {r.year}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-n600 whitespace-nowrap">{r.sale_date}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatBRL(r.receita)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-n600">{formatBRL(r.custo)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-n600">{formatBRL(r.despesas_diretas)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${r.margem_real >= 0 ? "text-success" : "text-danger"}`}>
                    {formatBRL(r.margem_real)}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${r.margem_real >= 0 ? "text-success" : "text-danger"}`}>
                    {pct.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

async function OperacionaisTab({ tenantId, month }: { tenantId: number; month: string }) {
  const rows = await getOperationalExpenses(tenantId, { month });
  return <OperationalExpenseList initialRows={rows} month={month} />;
}

function Kpi({
  icon: Icon, label, value, color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: "signal" | "success" | "danger" | "ink";
}) {
  const tones: Record<typeof color, string> = {
    signal:  "bg-signal/10 text-signal",
    success: "bg-success/12 text-success",
    danger:  "bg-danger/10 text-danger",
    ink:     "bg-n100 text-ink",
  };
  return (
    <div className="bg-white border border-n100 rounded-xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tones[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-n600">{label}</p>
        <p className="text-base font-semibold text-ink truncate">{value}</p>
      </div>
    </div>
  );
}

function Line({
  label, value, muted, bold, highlight,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
  highlight?: "positive" | "negative";
}) {
  return (
    <div className="px-5 py-3 flex items-center justify-between gap-3">
      <span className={`${bold ? "font-semibold text-ink" : "text-n600"}`}>{label}</span>
      <span
        className={`tabular-nums ${
          highlight === "positive"
            ? "text-success font-semibold"
            : highlight === "negative"
              ? "text-danger font-semibold"
              : muted
                ? "text-n600"
                : bold
                  ? "text-ink font-semibold"
                  : "text-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-4 py-2.5 text-xs font-semibold text-n600 uppercase tracking-wider ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
