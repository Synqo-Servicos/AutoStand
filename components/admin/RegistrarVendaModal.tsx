"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { Seller } from "@/types/seller";
import { computeCommission } from "@/lib/commission";
import { centsToDisplay, displayToCents } from "@/lib/money";
import {
  Button, Field, Input, Modal, Select, Textarea, toast, type SelectOption,
} from "@/components/ui";

/** Dados mínimos do veículo — Vehicle e PendingSale atendem os dois. */
export interface SaleVehicle {
  id: number;
  brand: string;
  model: string;
  year: number;
  sale_price: number;
}

interface Props {
  vehicle: SaleVehicle;
  /** Fechou sem registrar — a venda vira pendência em Transações. */
  onClose: () => void;
  /** Registrou com sucesso. */
  onSaved: () => void;
  /** Já existe uma venda (saída) lançada pra este veículo — avisa, mas não bloqueia. */
  hasExistingSale?: boolean;
}

// Radix Select não aceita "" como valor de Item — sentinela pra "sem vendedor".
const NONE_SELLER = "__none__";

export function RegistrarVendaModal({ vehicle, onClose, onSaved, hasExistingSale = false }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [amountStr,  setAmountStr]  = useState(centsToDisplay(vehicle.sale_price));
  const [date,       setDate]       = useState(today);
  const [buyerName,  setBuyerName]  = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [sellerId,   setSellerId]   = useState("");
  const [notes,      setNotes]      = useState("");
  const [sellers,    setSellers]    = useState<Seller[]>([]);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sellers")
      .then(r => r.json())
      .then((rows: Seller[]) => setSellers(rows.filter(s => s.status === "ativo")))
      .catch(() => {});
  }, []);

  const selectedSeller = sellers.find(s => String(s.id) === sellerId);
  const previewCommission = selectedSeller && amountStr
    ? computeCommission(displayToCents(amountStr), selectedSeller)
    : null;

  const sellerOptions: SelectOption[] = [
    { value: NONE_SELLER, label: "Sem vendedor" },
    ...sellers.map(s => ({ value: String(s.id), label: s.name })),
  ];

  async function handleSubmit() {
    setError(null);
    const amount = displayToCents(amountStr);
    if (amount <= 0) {
      setError("Informe o valor da venda.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id:  vehicle.id,
          type:        "saida",
          amount,
          date,
          buyer_name:  buyerName || null,
          buyer_phone: buyerPhone || null,
          seller_id:   sellerId ? Number(sellerId) : null,
          notes:       notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao registrar a venda");
      toast.success("Venda registrada.");
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleDismiss() {
    // Salvamento em andamento: um dismiss aqui não pode fingir que nada
    // aconteceu — o POST pode completar depois do unmount e registrar a
    // venda mesmo assim, deixando o veículo pronto pra um segundo registro
    // (duplicata que ninguém consegue apagar depois).
    if (saving) return;
    toast("Venda pendente. Você pode registrar depois em Transações.");
    onClose();
  }

  const label = `${vehicle.brand} ${vehicle.model} ${vehicle.year}`;

  return (
    <Modal
      open
      onOpenChange={(next) => { if (!next) handleDismiss(); }}
      size="xl"
      title="Registrar venda"
      description={`${label} foi marcado como vendido. Confirme os dados para lançar no financeiro.`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={handleDismiss} disabled={saving}>
            Agora não
          </Button>
          <Button type="button" onClick={handleSubmit} loading={saving}>
            {saving ? "Registrando..." : "Registrar venda"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {hasExistingSale && (
          <div className="flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/15 px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-ink" />
            <p className="text-body-s text-ink">
              Já existe uma venda lançada para este veículo — confirme que esta é uma nova venda.
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Valor da venda (R$)"
            required
            helperText={`Anunciado: R$ ${centsToDisplay(vehicle.sale_price)}`}
          >
            {(f) => (
              <Input
                id={f.id}
                required
                type="text"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                onBlur={() => setAmountStr(centsToDisplay(displayToCents(amountStr)))}
                placeholder="Ex: 79.900"
              />
            )}
          </Field>
          <Field label="Data da venda" required>
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
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome do comprador">
            {(f) => (
              <Input
                id={f.id}
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Nome completo"
              />
            )}
          </Field>
          <Field label="Telefone do comprador">
            {(f) => (
              <Input
                id={f.id}
                type="tel"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                placeholder="82999990000"
              />
            )}
          </Field>
        </div>

        <Field
          label="Vendedor"
          helperText={previewCommission != null && previewCommission > 0
            ? `Comissão automática: R$ ${centsToDisplay(previewCommission)}`
            : undefined}
        >
          {(f) => (
            <Select
              id={f.id}
              value={sellerId || NONE_SELLER}
              onValueChange={(v) => setSellerId(v === NONE_SELLER ? "" : v)}
              options={sellerOptions}
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
            />
          )}
        </Field>

        {error && (
          <p className="text-body-s text-danger bg-danger/10 border border-danger/30 rounded-lg px-4 py-2">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
