"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { centsToDisplay, displayToCents, formatBRL } from "@/lib/money";
import { EXPENSE_CATEGORIES, TRANSACTION_LABELS } from "@/lib/constants";
import { Button, Field, Input, Modal, Select, Textarea, useConfirm, toast } from "@/components/ui";
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
  despesa_fixa: "bg-warning/12 text-warning-dark ring-1 ring-warning/30",
  despesa_var:  "bg-warning/12 text-warning-dark ring-1 ring-warning/30",
  comissao:     "bg-n100 text-n700 ring-1 ring-n200",
};

export function OperationalExpenseList({ initialRows, month }: Props) {
  const [rows, setRows] = useState<OperationalExpenseRow[]>(initialRows);
  const [modalOpen, setModalOpen] = useState(false);
  const { confirm, dialog } = useConfirm();

  const total = useMemo(() => rows.reduce((a, r) => a + r.amount, 0), [rows]);

  async function handleDelete(id: number) {
    if (!(await confirm({ title: "Excluir esta despesa?", confirmLabel: "Excluir", danger: true }))) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Não foi possível excluir. Tente novamente.");
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
      {dialog}
      <section className="bg-white border border-n100 rounded-xl overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4 border-b border-n100">
          <div>
            <h2 className="text-sm font-semibold text-ink">Despesas operacionais</h2>
            <p className="text-xs text-n400 mt-0.5">
              Aluguel, energia, marketing, comissão e afins. Período: {month}.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setModalOpen(true)}
            leadingIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Adicionar despesa
          </Button>
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
              <li key={r.id} className="px-5 py-3 flex flex-wrap items-center gap-3 text-sm hover:bg-n50/60">
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(r.id)}
                  aria-label="Excluir"
                  className="text-danger hover:bg-danger/10 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
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

  async function handleSubmit() {
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
    <Modal
      open
      onOpenChange={(next) => { if (!next) onClose(); }}
      title="Nova despesa operacional"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} loading={saving}>
            {saving ? "Salvando..." : "Adicionar"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="block text-eyebrow text-n700 mb-1.5">Tipo *</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {TYPE_OPTIONS.map((opt) => (
              <Button
                key={opt.id}
                type="button"
                variant={type === opt.id ? "secondary" : "outline"}
                size="sm"
                onClick={() => handleTypeChange(opt.id)}
              >
                {opt.label.replace(/\s*\(.*\)\s*$/, "")}
              </Button>
            ))}
          </div>
        </div>

        <Field label="Categoria" required>
          {(f) => (
            <Select
              id={f.id}
              value={category}
              onValueChange={setCategory}
              options={categories.map((c) => ({ value: c, label: c }))}
            />
          )}
        </Field>

        <Field label="Valor (R$)" required>
          {(f) => (
            <Input
              id={f.id}
              required
              type="text"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              onBlur={() => setAmountStr(centsToDisplay(displayToCents(amountStr)))}
              placeholder="Ex: 3.500"
            />
          )}
        </Field>

        <Field label="Data" required>
          {(f) => (
            <Input
              id={f.id}
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          )}
        </Field>

        <Field label="Observações">
          {(f) => (
            <Textarea
              id={f.id}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none"
              placeholder="Ex: aluguel maio"
            />
          )}
        </Field>

        {error && (
          <p className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
