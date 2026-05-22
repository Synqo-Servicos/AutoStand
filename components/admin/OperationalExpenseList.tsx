"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { centsToDisplay, displayToCents, formatBRL } from "@/lib/money";
import { EXPENSE_CATEGORIES, TRANSACTION_LABELS } from "@/lib/constants";
import type { OperationalExpenseRow } from "@/lib/db";

interface Props {
  initialRows: OperationalExpenseRow[];
  month: string;
}

type OpType = "despesa_fixa" | "despesa_var" | "comissao";

const TYPE_OPTIONS: { id: OpType; label: string; categories: readonly string[] }[] = [
  { id: "despesa_fixa", label: TRANSACTION_LABELS.despesa_fixa,
    categories: [...EXPENSE_CATEGORIES.estrutura, ...EXPENSE_CATEGORIES.pessoal, ...EXPENSE_CATEGORIES.impostos] },
  { id: "despesa_var",  label: TRANSACTION_LABELS.despesa_var,
    categories: [...EXPENSE_CATEGORIES.operacao] },
  { id: "comissao",     label: TRANSACTION_LABELS.comissao,
    categories: ["Comissão de venda", "Bônus", "Outros"] },
];

const TYPE_BADGE: Record<OpType, string> = {
  despesa_fixa: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  despesa_var:  "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  comissao:     "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
};

const inp =
  "w-full border border-n200 rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-signal focus:border-transparent transition-shadow";
const lbl = "block text-xs font-medium text-n600 mb-1";

export function OperationalExpenseList({ initialRows, month }: Props) {
  const [rows, setRows] = useState<OperationalExpenseRow[]>(initialRows);
  const [modalOpen, setModalOpen] = useState(false);

  const total = useMemo(() => rows.reduce((a, r) => a + r.amount, 0), [rows]);

  async function handleDelete(id: number) {
    if (!confirm("Excluir esta despesa?")) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Erro ao excluir");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function handleCreated(row: OperationalExpenseRow) {
    setRows((prev) =>
      [row, ...prev].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id)),
    );
    setModalOpen(false);
  }

  return (
    <>
      <section className="bg-white border border-n100 rounded-xl overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4 border-b border-n100">
          <div>
            <h2 className="text-sm font-semibold text-ink">Despesas operacionais</h2>
            <p className="text-xs text-n400 mt-0.5">
              Aluguel, energia, marketing, comissão e afins. Período: {month}.
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

        <div className="px-5 py-3 bg-n50 border-b border-n100 flex items-center justify-between text-sm">
          <span className="text-n600">Total no período</span>
          <span className="font-semibold text-ink tabular-nums">{formatBRL(total)}</span>
        </div>

        {rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-n400">
            Nenhuma despesa operacional registrada no período.
          </div>
        ) : (
          <ul className="divide-y divide-n100">
            {rows.map((r) => (
              <li key={r.id} className="px-5 py-3 flex items-center gap-3 text-sm hover:bg-n50/60">
                <span className="text-xs text-n400 w-20 shrink-0">{formatDate(r.date)}</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${TYPE_BADGE[r.type as OpType] ?? "bg-n100 text-n600"}`}
                >
                  {TRANSACTION_LABELS[r.type as OpType] ?? r.type}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink truncate">{r.category ?? "—"}</p>
                  {r.notes && <p className="text-xs text-n600 truncate">{r.notes}</p>}
                </div>
                <span className="font-medium text-ink whitespace-nowrap">{formatBRL(r.amount)}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  className="w-7 h-7 flex items-center justify-center rounded text-n400 hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                  aria-label="Excluir"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {modalOpen && (
        <AddOperationalModal
          onClose={() => setModalOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}

function formatDate(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

interface ModalProps {
  onClose: () => void;
  onCreated: (row: OperationalExpenseRow) => void;
}

function AddOperationalModal({ onClose, onCreated }: ModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [type, setType] = useState<OpType>("despesa_fixa");
  const [category, setCategory] = useState<string>(TYPE_OPTIONS[0].categories[0]);
  const [amountStr, setAmountStr] = useState("");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = TYPE_OPTIONS.find((o) => o.id === type)?.categories ?? [];

  function handleTypeChange(next: OpType) {
    setType(next);
    const nextCats = TYPE_OPTIONS.find((o) => o.id === next)?.categories ?? [];
    setCategory(nextCats[0] ?? "");
  }

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
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          category: category || null,
          amount,
          date,
          vehicle_id: null,
          seller_id: null,
          buyer_name: null,
          buyer_phone: null,
          notes: notes.trim() ? notes.trim() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      onCreated({
        id: data.id,
        type: data.type,
        category: data.category,
        amount: data.amount,
        date: data.date,
        notes: data.notes,
        seller_id: data.seller_id,
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
          <h3 className="text-base font-semibold text-ink">Nova despesa operacional</h3>
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
            <label className={lbl}>Tipo *</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleTypeChange(opt.id)}
                  className={`py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    type === opt.id
                      ? "bg-ink text-white border-ink"
                      : "border-n200 text-n600 hover:bg-n50"
                  }`}
                >
                  {opt.label.replace(/\s*\(.*\)\s*$/, "")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={lbl}>Categoria *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inp}
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
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
              placeholder="Ex: 3.500"
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
              placeholder="Ex: aluguel maio"
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
