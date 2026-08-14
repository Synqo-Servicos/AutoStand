"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import type { PayableRow } from "@/lib/schema";
import {
  PAYABLE_FREQUENCY_LABELS, PAYMENT_METHOD_LABELS,
  type PayableFrequency, type PaymentMethod,
} from "@/lib/constants";
import { formatBRL } from "@/lib/money";
import { Button, Modal, toast, useConfirm } from "@/components/ui";

interface Props {
  payables: PayableRow[];
  onClose: () => void;
  /**
   * Pede pro chamador (ContasAPagarTab) fechar este painel e abrir o
   * PayableForm em modo de edição — ver nota de "aninhamento de modais"
   * no relatório da Task 10. Os dois `Modal` nunca ficam abertos ao mesmo
   * tempo; só o `useConfirm` (diálogo pequeno, size="sm") sobe por cima
   * deste painel, o mesmo padrão já usado em VendedoresList/TenantForm.
   */
  onEdit: (payable: PayableRow) => void;
}

export function PayableRulesPanel({ payables, onClose, onEdit }: Props) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null);

  async function handleDeactivate(p: PayableRow) {
    const ok = await confirm({
      title: `Desativar "${p.category ?? p.description ?? "conta"}"?`,
      description: "Ela para de gerar vencimentos daqui pra frente. Os pagamentos já registrados continuam no financeiro.",
      confirmLabel: "Desativar",
      danger: true,
    });
    if (!ok) return;

    setDeactivatingId(p.id);
    const res = await fetch(`/api/payables/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    setDeactivatingId(null);

    if (!res.ok) {
      toast.error("Não foi possível desativar. Tente novamente.");
      return;
    }
    router.refresh();
  }

  return (
    <Modal
      open
      onOpenChange={(next) => { if (!next) onClose(); }}
      size="lg"
      title="Contas cadastradas"
      description="Editar altera a regra para os próximos vencimentos. Desativar não apaga o histórico já pago."
    >
      {dialog}
      {payables.length === 0 ? (
        <p className="text-body-s text-n500 text-center py-8">Nenhuma conta cadastrada ainda.</p>
      ) : (
        <ul className="divide-y divide-n100">
          {payables.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink truncate">
                  {p.category ?? p.description ?? "Conta"}
                  {p.supplier && <span className="text-n500 font-normal"> · {p.supplier}</span>}
                </p>
                <p className="text-xs text-n500">
                  {PAYABLE_FREQUENCY_LABELS[p.frequency as PayableFrequency] ?? p.frequency}
                  {" · a partir de "}{p.first_due_date.split("-").reverse().join("/")}
                  {p.installments && ` · ${p.installments}x`}
                  {p.payment_method && ` · ${PAYMENT_METHOD_LABELS[p.payment_method as PaymentMethod] ?? p.payment_method}`}
                </p>
              </div>
              <span className="text-sm text-n600 whitespace-nowrap">
                {p.amount_cents ? formatBRL(p.amount_cents) : "—"}
              </span>
              <Button size="sm" variant="outline" onClick={() => onEdit(p)}
                leadingIcon={<Pencil className="w-3.5 h-3.5" />}>
                Editar
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDeactivate(p)}
                loading={deactivatingId === p.id}
                className="text-danger hover:border-danger/40 hover:bg-danger/10">
                Desativar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
