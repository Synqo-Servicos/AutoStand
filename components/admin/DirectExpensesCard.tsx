"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { centsToDisplay, displayToCents, formatBRL } from "@/lib/money";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import type { Transaction } from "@/types/transaction";

interface Props {
  vehicleId: number;
  costPrice: number;
  salePrice: number;
  vehicleStatus: string;
  initialExpenses: Transaction[];
}

const inp =
  "w-full border border-n200 rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-signal focus:border-transparent transition-shadow";
const lbl = "block text-xs font-medium text-n600 mb-1";

const CATEGORIES = EXPENSE_CATEGORIES.veiculo;

export function DirectExpensesCard({
  vehicleId,
  costPrice,
  salePrice,
  vehicleStatus,
  initialExpenses,
}: Props) {
  const [expenses, setExpenses] = useState<Transaction[]>(initialExpenses);
  const [modalOpen, setModalOpen] = useState(false);

  const totalExpenses = useMemo(
    () => expenses.reduce((acc, e) => acc + e.amount, 0),
    [expenses],
  );
  const margin = salePrice - costPrice - totalExpenses;
  const marginPct = salePrice > 0 ? (margin / salePrice) * 100 : 0;
  const isRealized = vehicleStatus === "vendido";

  async function handleAdd(input: {
    category: string;
    amount: number;
    date: string;
    notes: string | null;
  }) {
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicle_id: vehicleId,
        type: "despesa_direta",
        category: input.category,
        amount: input.amount,
        date: input.date,
        notes: input.notes,
        buyer_name: null,
        buyer_phone: null,
        seller_id: null,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
    setExpenses((prev) =>
      [data as Transaction, ...prev].sort((a, b) =>
        a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id,
      ),
    );
  }

  async function handleDelete(id: number) {
    if (!confirm("Excluir esta despesa?")) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Erro ao excluir");
      return;
    }
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <section className="bg-white border border-n100 rounded-xl overflow-hidden">
      <header className="flex items-center justify-between px-5 py-4 border-b border-n100">
        <div>
          <h2 className="text-sm font-semibold text-ink">Custos diretos &amp; Margem real</h2>
          <p className="text-xs text-n400 mt-0.5">
            {isRealized
              ? "Margem realizada — venda já registrada."
              : "Margem projetada — usa o preço de venda atual."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 bg-signal text-ink text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-signal-dark transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar despesa
        </button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 px-5 py-4 text-sm">
        <Row label="Preço de venda" value={formatBRL(salePrice)} />
        <Row label="Preço de custo" value={`− ${formatBRL(costPrice)}`} muted />
        <Row label="Despesas diretas" value={`− ${formatBRL(totalExpenses)}`} muted />
        <Row
          label={isRealized ? "Margem real" : "Margem projetada"}
          value={`${formatBRL(margin)} (${marginPct.toFixed(1)}%)`}
          highlight={margin >= 0 ? "positive" : "negative"}
        />
      </div>

      <div className="border-t border-n100">
        {expenses.length === 0 ? (
          <div className="py-8 text-center text-xs text-n400">
            Nenhuma despesa registrada para este veículo.
          </div>
        ) : (
          <ul className="divide-y divide-n100">
            {expenses.map((e) => (
              <li
                key={e.id}
                className="px-5 py-3 flex items-center justify-between gap-3 text-sm hover:bg-n50/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-ink">{e.category}</span>
                    <span className="text-xs text-n400">{formatDate(e.date)}</span>
                  </div>
                  {e.notes && <p className="text-xs text-n600 mt-0.5 truncate">{e.notes}</p>}
                </div>
                <span className="font-medium text-ink whitespace-nowrap">
                  {formatBRL(e.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(e.id)}
                  className="w-7 h-7 flex items-center justify-center rounded text-n400 hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                  aria-label="Excluir"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modalOpen && (
        <AddExpenseModal
          onClose={() => setModalOpen(false)}
          onSubmit={async (data) => {
            await handleAdd(data);
            setModalOpen(false);
          }}
        />
      )}
    </section>
  );
}

function Row({
  label,
  value,
  muted,
  highlight,
}: {
  label: string;
  value: string;
  muted?: boolean;
  highlight?: "positive" | "negative";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${highlight ? "font-semibold text-ink" : "text-n600"}`}>
        {label}
      </span>
      <span
        className={`tabular-nums ${
          highlight === "positive"
            ? "text-success font-semibold"
            : highlight === "negative"
              ? "text-danger font-semibold"
              : muted
                ? "text-n600"
                : "text-ink font-medium"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function formatDate(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

interface ModalProps {
  onClose: () => void;
  onSubmit: (data: {
    category: string;
    amount: number;
    date: string;
    notes: string | null;
  }) => Promise<void>;
}

function AddExpenseModal({ onClose, onSubmit }: ModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [amountStr, setAmountStr] = useState("");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = displayToCents(amountStr);
    if (amount <= 0) {
      setError("Informe um valor válido");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        category,
        amount,
        date,
        notes: notes.trim() ? notes.trim() : null,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-n100">
          <h3 className="text-base font-semibold text-ink">Nova despesa direta</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-n400 hover:bg-n100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={lbl}>Categoria *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inp}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={lbl}>Valor (R$) *</label>
            <input
              required
              type="text"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              onBlur={() => setAmountStr(centsToDisplay(displayToCents(amountStr)))}
              className={inp}
              placeholder="Ex: 1.500"
            />
          </div>

          <div>
            <label className={lbl}>Data *</label>
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inp}
            />
          </div>

          <div>
            <label className={lbl}>Observações</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${inp} resize-none`}
              placeholder="Ex: nota fiscal #1234"
            />
          </div>

          {error && (
            <p className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="bg-n50 border-t border-n100 px-5 py-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-n200 rounded-lg text-n600 hover:bg-white transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-signal text-ink rounded-lg hover:bg-signal-dark disabled:opacity-50 transition-colors cursor-pointer"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? "Salvando..." : "Adicionar"}
          </button>
        </div>
      </form>
    </div>
  );
}
