"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BillWithPayable } from "@/lib/db/payables";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { centsToDisplay, displayToCents } from "@/lib/money";
import { Button, Field, Input, Modal, Select } from "@/components/ui";

interface Props {
  bill: BillWithPayable;
  onClose: () => void;
}

export function RegistrarPagamentoModal({ bill, onClose }: Props) {
  const router = useRouter();
  // pt-BR + timeZone explícito: `toISOString().slice(0,10)` devolveria a data
  // em UTC, e às 21h de Maceió já seria "amanhã" no campo.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

  const [amount, setAmount] = useState(bill.amount_cents ? centsToDisplay(bill.amount_cents) : "");
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState(bill.payment_method ?? "boleto");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const cents = displayToCents(amount);
    if (cents <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch(`/api/payables/${bill.payable_id}/pagar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        due_date: bill.due_date,
        amount: cents,
        date,
        payment_method: method,
        notes: notes.trim() || null,
      }),
    });

    if (!res.ok) {
      // 409 = vencimento já pago (trava de duplicata do servidor) — a
      // mensagem vem pronta em pt-BR do backend, exibida como qualquer
      // outro erro de validação.
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao registrar pagamento");
      setLoading(false);
      return;
    }

    onClose();
    router.refresh();
  }

  function handleDismiss() {
    if (loading) return;
    onClose();
  }

  const [y, m, d] = bill.due_date.split("-");

  return (
    <Modal
      open
      onOpenChange={(next) => { if (!next) handleDismiss(); }}
      title="Registrar pagamento"
      description={
        <>
          <strong className="text-ink">{bill.category ?? bill.description ?? "Conta"}</strong>
          {bill.supplier && ` · ${bill.supplier}`} · vence {d}/{m}/{y}
        </>
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={handleDismiss} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} loading={loading}>
            Registrar pagamento
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="text-body-s text-danger bg-danger/10 border border-danger/30 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Valor pago" required helperText="Pré-preenchido com o previsto — ajuste se veio diferente.">
            {(f) => (
              <Input
                id={f.id} required inputMode="decimal" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onBlur={() => setAmount(amount.trim() ? centsToDisplay(displayToCents(amount)) : "")}
              />
            )}
          </Field>

          <Field label="Data do pagamento" required>
            {(f) => (
              <Input id={f.id} type="date" required value={date}
                onChange={(e) => setDate(e.target.value)} />
            )}
          </Field>
        </div>

        <Field label="Forma de pagamento">
          {(f) => (
            <Select id={f.id} value={method} onValueChange={setMethod}
              options={PAYMENT_METHODS.map((mm) => ({ value: mm, label: PAYMENT_METHOD_LABELS[mm] }))} />
          )}
        </Field>

        <Field label="Observação">
          {(f) => (
            <Input id={f.id} value={notes} onChange={(e) => setNotes(e.target.value)} />
          )}
        </Field>
      </div>
    </Modal>
  );
}
