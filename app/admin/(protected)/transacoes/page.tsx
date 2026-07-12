"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { TransactionSlideOver } from "@/components/admin/TransactionSlideOver";
import { MonthlyTable } from "@/components/admin/MonthlyTable";
import { formatBRL } from "@/lib/money";
import type { TransactionWithVehicle } from "@/types/transaction";
import type { Vehicle } from "@/types/vehicle";
import type { MonthlyData } from "@/types/dashboard";

const TYPE_LABEL: Record<string, string> = {
  entrada: "Entrada",
  saida: "Saída",
  despesa_direta: "Custo direto",
  despesa_fixa: "Despesa fixa",
  despesa_var: "Despesa variável",
  comissao: "Comissão",
};
const TYPE_COLOR: Record<string, string> = {
  entrada: "bg-signal/10 text-signal ring-1 ring-signal",
  saida:   "bg-success/12 text-ink ring-1 ring-success/30",
  despesa_direta: "bg-warning/12 text-warning-dark ring-1 ring-warning/30",
  despesa_fixa: "bg-warning/12 text-warning-dark ring-1 ring-warning/30",
  despesa_var: "bg-warning/12 text-warning-dark ring-1 ring-warning/30",
  comissao: "bg-n100 text-n700 ring-1 ring-n200",
};

export default function TransacoesPage() {
  const [transactions, setTransactions] = useState<TransactionWithVehicle[]>([]);
  const [vehicles,     setVehicles]     = useState<Vehicle[]>([]);
  const [monthly,      setMonthly]      = useState<MonthlyData[]>([]);
  const [slideOver,    setSlideOver]    = useState(false);
  const [loading,      setLoading]      = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [tx, veh, dash] = await Promise.all([
      fetch("/api/transactions").then(r => r.json()),
      fetch("/api/vehicles").then(r => r.json()),
      fetch("/api/dashboard").then(r => r.json()),
    ]);
    setTransactions(tx);
    setVehicles(veh);
    setMonthly(dash.monthly ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
        <div className="min-w-0">
          <h1 className="font-display text-h2 font-semibold text-ink">Transações</h1>
          <p className="text-sm text-n600 mt-1">Entradas e saídas de veículos</p>
        </div>
        <button
          onClick={() => setSlideOver(true)}
          className="inline-flex items-center gap-1.5 bg-signal text-ink text-sm font-medium px-3 sm:px-4 py-2 rounded-lg hover:bg-signal-dark transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nova transação</span>
          <span className="sm:hidden">Nova</span>
        </button>
      </div>

      {/* Monthly breakdown */}
      <div className="bg-white rounded-xl border border-n100 overflow-hidden mb-6">
        <div className="px-5 sm:px-6 py-4 border-b border-n100">
          <h2 className="font-display text-h3 font-semibold text-ink">Vendas por mês</h2>
        </div>
        <MonthlyTable data={monthly} />
      </div>

      {/* Transactions list */}
      <div className="bg-white rounded-xl border border-n100 overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-n100">
          <h2 className="font-display text-h3 font-semibold text-ink">Histórico de transações</h2>
        </div>
        {loading ? (
          <div className="py-16 text-center text-n400 text-sm">Carregando...</div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center text-n400 text-sm">
            Nenhuma transação registrada ainda.
          </div>
        ) : (
          <>
            {/* Desktop: tabela */}
            <table className="hidden md:table min-w-full divide-y divide-n100 text-sm">
              <thead>
                <tr className="bg-n50">
                  {["Data", "Tipo", "Veículo", "Valor", "Comprador", "Obs."].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-n600 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-n100">
                {transactions.map(t => (
                  <tr key={t.id} className="hover:bg-n50 transition-colors">
                    <td className="px-4 py-3 text-n600 whitespace-nowrap">{t.date}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOR[t.type]}`}>
                        {TYPE_LABEL[t.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">
                      {t.vehicle_brand} {t.vehicle_model} {t.vehicle_year}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">{formatBRL(t.amount)}</td>
                    <td className="px-4 py-3 text-n600 whitespace-nowrap">{t.buyer_name ?? "—"}</td>
                    <td className="px-4 py-3 text-n400 max-w-[200px] truncate">{t.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile: cards */}
            <ul className="md:hidden divide-y divide-n100">
              {transactions.map(t => (
                <li key={t.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${TYPE_COLOR[t.type]}`}>
                          {TYPE_LABEL[t.type]}
                        </span>
                        <span className="text-xs text-n400">{t.date}</span>
                      </div>
                      <p className="font-medium text-ink truncate">
                        {t.vehicle_brand && t.vehicle_model
                          ? `${t.vehicle_brand} ${t.vehicle_model} ${t.vehicle_year ?? ""}`.trim()
                          : t.category ?? "—"}
                      </p>
                      {t.buyer_name && (
                        <p className="text-xs text-n600 mt-0.5 truncate">Comprador: {t.buyer_name}</p>
                      )}
                      {t.notes && (
                        <p className="text-xs text-n400 mt-0.5 line-clamp-2">{t.notes}</p>
                      )}
                    </div>
                    <span className="font-semibold text-ink tabular-nums whitespace-nowrap">
                      {formatBRL(t.amount)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {slideOver && (
        <TransactionSlideOver
          vehicles={vehicles}
          onClose={() => setSlideOver(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
