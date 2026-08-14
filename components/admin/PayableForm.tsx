"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PayableRow } from "@/lib/schema";
import {
  ALL_EXPENSE_CATEGORIES, MAX_INSTALLMENTS,
  PAYABLE_FREQUENCIES, PAYABLE_FREQUENCY_LABELS,
  PAYMENT_METHODS, PAYMENT_METHOD_LABELS,
} from "@/lib/constants";
import { displayToCents, centsToDisplayFull } from "@/lib/money";
import { Button, Field, Input, Modal, Select } from "@/components/ui";

interface Props {
  /** Presente = edição (dispara PATCH). Ausente = criação (POST). */
  payable?: PayableRow;
  onClose: () => void;
}

export function PayableForm({ payable, onClose }: Props) {
  const router = useRouter();
  const isEdit = !!payable;

  const [form, setForm] = useState({
    type: payable?.type ?? "despesa_fixa",
    category: payable?.category ?? ALL_EXPENSE_CATEGORIES[0],
    description: payable?.description ?? "",
    supplier: payable?.supplier ?? "",
    amount: payable?.amount_cents ? centsToDisplayFull(payable.amount_cents) : "",
    frequency: payable?.frequency ?? "mensal",
    first_due_date: payable?.first_due_date ?? "",
    installments: payable?.installments ? String(payable.installments) : "",
    payment_method: payable?.payment_method ?? "boleto",
    notes: payable?.notes ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit() {
    setError(null);

    if (!form.category.trim()) {
      setError("Informe a categoria.");
      return;
    }
    if (!form.first_due_date) {
      setError("Informe o primeiro vencimento.");
      return;
    }

    const parcelas = form.installments ? Number(form.installments) : null;
    if (parcelas !== null && (parcelas < 1 || parcelas > MAX_INSTALLMENTS)) {
      setError(`Parcelas deve ficar entre 1 e ${MAX_INSTALLMENTS}.`);
      return;
    }

    // "Valor previsto" pode ficar em branco de propósito (o valor real é
    // digitado ao pagar) — mas se algo foi digitado, tem de virar um valor
    // válido. Sem isso, lixo digitado (ou um "0" digitado sem querer) vira
    // silenciosamente amount_cents: 0, e o aviso de vencimento sai com
    // valor zerado.
    const amountTrimmed = form.amount.trim();
    const amountCents = amountTrimmed ? displayToCents(amountTrimmed) : null;
    if (amountTrimmed && (amountCents === null || amountCents <= 0)) {
      setError("Valor previsto inválido — apague o campo se ainda não souber o valor.");
      return;
    }

    setLoading(true);

    const body = {
      type: form.type,
      category: form.category.trim() || null,
      description: form.description.trim() || null,
      supplier: form.supplier.trim() || null,
      amount_cents: amountCents,
      frequency: form.frequency,
      first_due_date: form.first_due_date,
      // Conta única não é parcelável — a API rejeita installments > 1 com
      // frequency "unica"; o form nunca deixa esse par chegar ao servidor.
      installments: form.frequency === "unica" ? null : parcelas,
      payment_method: form.payment_method || null,
      notes: form.notes.trim() || null,
    };

    const res = await fetch(
      isEdit ? `/api/payables/${payable.id}` : "/api/payables",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao salvar");
      setLoading(false);
      return;
    }

    onClose();
    router.refresh();
  }

  function handleDismiss() {
    // Mesma cautela do RegistrarVendaModal: um dismiss no meio do salvamento
    // não pode fingir que nada está em andamento.
    if (loading) return;
    onClose();
  }

  return (
    <Modal
      open
      onOpenChange={(next) => { if (!next) handleDismiss(); }}
      size="xl"
      title={isEdit ? "Editar conta" : "Nova conta"}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={handleDismiss} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} loading={loading}>
            {isEdit ? "Salvar" : "Cadastrar conta"}
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
          <Field label="Categoria" required helperText="Escolha uma ou digite a sua.">
            {(f) => (
              <Input
                id={f.id} required list="cat-list"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="Aluguel"
              />
            )}
          </Field>

          <Field label="Fornecedor">
            {(f) => (
              <Input id={f.id} value={form.supplier}
                onChange={(e) => set("supplier", e.target.value)}
                placeholder="Imobiliária Costa" />
            )}
          </Field>
        </div>
        <datalist id="cat-list">
          {ALL_EXPENSE_CATEGORIES.map((c) => <option key={c} value={c} />)}
        </datalist>

        <Field label="Descrição">
          {(f) => (
            <Input id={f.id} value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Aluguel do galpão" />
          )}
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Tipo" required>
            {(f) => (
              <Select id={f.id} value={form.type}
                onValueChange={(v) => set("type", v)}
                options={[
                  { value: "despesa_fixa", label: "Despesa fixa" },
                  { value: "despesa_var",  label: "Despesa variável" },
                ]} />
            )}
          </Field>

          <Field label="Valor previsto" helperText="O valor real é digitado ao pagar.">
            {(f) => (
              <Input id={f.id} inputMode="decimal" value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                onBlur={() => set("amount", form.amount.trim() ? centsToDisplayFull(displayToCents(form.amount)) : "")}
                placeholder="4.500,00" />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Frequência" required>
            {(f) => (
              <Select id={f.id} value={form.frequency}
                onValueChange={(v) => set("frequency", v)}
                options={PAYABLE_FREQUENCIES.map((s) => ({ value: s, label: PAYABLE_FREQUENCY_LABELS[s] }))} />
            )}
          </Field>

          <Field label="Primeiro vencimento" required>
            {(f) => (
              <Input id={f.id} type="date" required value={form.first_due_date}
                onChange={(e) => set("first_due_date", e.target.value)} />
            )}
          </Field>

          <Field label="Parcelas"
            helperText={form.frequency === "unica" ? "Conta única não é parcelada." : "Vazio = sem fim definido."}>
            {(f) => (
              <Input id={f.id} type="number" min={1} max={MAX_INSTALLMENTS}
                disabled={form.frequency === "unica"}
                value={form.frequency === "unica" ? "" : form.installments}
                onChange={(e) => set("installments", e.target.value)}
                placeholder="12" />
            )}
          </Field>
        </div>

        <Field label="Forma de pagamento"
          helperText="Débito automático recebe só o aviso de 3 dias antes — não entra em atrasadas.">
          {(f) => (
            <Select id={f.id} value={form.payment_method}
              onValueChange={(v) => set("payment_method", v)}
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} />
          )}
        </Field>

        <Field label="Observações">
          {(f) => (
            <Input id={f.id} value={form.notes}
              onChange={(e) => set("notes", e.target.value)} />
          )}
        </Field>
      </div>
    </Modal>
  );
}
