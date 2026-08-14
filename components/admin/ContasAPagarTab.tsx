"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import type { PayableRow } from "@/lib/schema";
import type { BillWithPayable } from "@/lib/db/payables";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/constants";
import { formatBRL } from "@/lib/money";
import { EmptyState } from "@/components/ui";

const GROUPS = [
  { id: "atrasado",  label: "Atrasadas",          tone: "text-danger" },
  { id: "vence_hoje", label: "Vencem hoje",       tone: "text-warning" },
  { id: "a_vencer",  label: "Próximas",           tone: "text-ink" },
  { id: "aguardando_conciliacao", label: "Débito automático — confirmar", tone: "text-n600" },
  { id: "pago",      label: "Pagas",              tone: "text-n500" },
] as const;

function brDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function ContasAPagarTab({
  bills, payables,
}: { bills: BillWithPayable[]; payables: PayableRow[] }) {
  const [rows] = useState(bills);

  const grouped = useMemo(
    () => GROUPS.map((g) => ({ ...g, items: rows.filter((b) => b.status === g.id) }))
                .filter((g) => g.items.length > 0),
    [rows],
  );

  const totalAberto = useMemo(
    () => rows.filter((b) => b.status !== "pago")
              .reduce((acc, b) => acc + (b.amount_cents ?? 0), 0),
    [rows],
  );

  if (payables.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Nenhuma conta cadastrada"
        description="Cadastre aluguel, energia, impostos e outras contas para receber aviso antes do vencimento."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-n600">
          Em aberto na janela: <strong className="text-ink">{formatBRL(totalAberto)}</strong>
        </p>
      </div>

      {grouped.map((group) => (
        <section key={group.id} className="space-y-2">
          <h3 className={`text-eyebrow ${group.tone}`}>
            {group.label} · {group.items.length}
          </h3>
          <ul className="rounded-xl border border-n200 bg-white divide-y divide-n100">
            {group.items.map((b) => (
              <li key={`${b.payable_id}:${b.due_date}`} className="flex items-center gap-3 px-4 py-3">
                {b.status === "atrasado" && <AlertTriangle className="w-4 h-4 text-danger shrink-0" />}
                {b.status === "pago" && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink truncate">
                    {b.category ?? b.description ?? "Conta"}
                    {b.supplier && <span className="text-n500 font-normal"> · {b.supplier}</span>}
                  </p>
                  <p className="text-xs text-n500">
                    {brDate(b.due_date)}
                    {b.installment && ` · parcela ${b.installment} de ${b.installments}`}
                    {b.payment_method && ` · ${PAYMENT_METHOD_LABELS[b.payment_method as PaymentMethod] ?? b.payment_method}`}
                  </p>
                </div>
                <span className="font-medium text-ink whitespace-nowrap">
                  {formatBRL(b.status === "pago" ? (b.paid_amount_cents ?? 0) : (b.amount_cents ?? 0))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
