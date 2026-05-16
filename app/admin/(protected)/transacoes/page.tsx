"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { TransactionSlideOver } from "@/components/admin/TransactionSlideOver";
import { MonthlyTable } from "@/components/admin/MonthlyTable";
import { formatBRL } from "@/lib/money";
import type { TransactionWithVehicle } from "@/types/transaction";
import type { Vehicle } from "@/types/vehicle";
import type { MonthlyData } from "@/types/dashboard";

const TYPE_LABEL = { entrada: "Entrada", saida: "Saída" };
const TYPE_COLOR = {
  entrada: "bg-signal/10 text-signal ring-1 ring-signal",
  saida:   "bg-success/12 text-ink ring-1 ring-success/30",
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
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Transações</h1>
          <p className="text-sm text-n600 mt-1">Entradas e saídas de veículos</p>
        </div>
        <button
          onClick={() => setSlideOver(true)}
          className="inline-flex items-center gap-2 bg-signal text-ink text-sm font-medium px-4 py-2 rounded-lg hover:bg-signal-dark transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nova transação
        </button>
      </div>

      {/* Monthly breakdown */}
      <div className="bg-white rounded-xl border border-n100 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-n100">
          <h2 className="text-sm font-semibold text-ink">Vendas por mês</h2>
        </div>
        <MonthlyTable data={monthly} />
      </div>

      {/* Transactions list */}
      <div className="bg-white rounded-xl border border-n100 overflow-hidden">
        <div className="px-6 py-4 border-b border-n100">
          <h2 className="text-sm font-semibold text-ink">Histórico de transações</h2>
        </div>
        {loading ? (
          <div className="py-16 text-center text-n400 text-sm">Carregando...</div>
        ) : (
          <table className="min-w-full divide-y divide-n100 text-sm">
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
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-n400 text-sm">
                    Nenhuma transação registrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
