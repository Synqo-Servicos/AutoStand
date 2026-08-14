"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CalendarSearch, CheckCircle2, Plus } from "lucide-react";
import type { PayableRow } from "@/lib/schema";
import type { BillWithPayable } from "@/lib/db/payables";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/constants";
import { formatBRL } from "@/lib/money";
import { Button, EmptyState } from "@/components/ui";
import { PayableForm } from "./PayableForm";
import { PayableRulesPanel } from "./PayableRulesPanel";
import { RegistrarPagamentoModal } from "./RegistrarPagamentoModal";

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
  // `bills`/`payables` são as props vindas do Server Component pai — usadas
  // direto (sem cópia em useState) pra refletirem sozinhas depois de um
  // router.refresh() disparado por cadastro, pagamento ou desativação. Uma
  // cópia congelada em useState(bills) ficaria presa nos dados do primeiro
  // render e nunca acompanharia o refresh.
  const [payableForm, setPayableForm] = useState<PayableRow | "new" | null>(null);
  const [pagando, setPagando] = useState<BillWithPayable | null>(null);
  const [gerindo, setGerindo] = useState(false);

  const grouped = useMemo(
    () => GROUPS.map((g) => ({ ...g, items: bills.filter((b) => b.status === g.id) }))
                .filter((g) => g.items.length > 0),
    [bills],
  );

  const totalAberto = useMemo(
    () => bills.filter((b) => b.status !== "pago")
              .reduce((acc, b) => acc + (b.amount_cents ?? 0), 0),
    [bills],
  );

  function closePayableForm() {
    // Editar veio do PayableRulesPanel, que se fechou antes de abrir este
    // form (nunca dois `Modal` abertos ao mesmo tempo — ver relatório da
    // Task 10). Ao fechar o form de edição, volta pro painel de regras.
    const wasEditing = payableForm !== null && payableForm !== "new";
    setPayableForm(null);
    if (wasEditing) setGerindo(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-n600">
          Em aberto na janela: <strong className="text-ink">{formatBRL(totalAberto)}</strong>
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setGerindo(true)}>
            Contas cadastradas
          </Button>
          <Button leadingIcon={<Plus className="w-4 h-4" />} onClick={() => setPayableForm("new")}>
            Nova conta
          </Button>
        </div>
      </div>

      {payables.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nenhuma conta cadastrada"
          description="Cadastre aluguel, energia, impostos e outras contas para receber aviso antes do vencimento."
        />
      ) : grouped.length === 0 ? (
        // Há contas cadastradas, mas nenhuma ocorrência cai na janela exibida
        // (defaultWindow em lib/recurring.ts: dos últimos 2 meses até o fim do
        // mês que vem). Acontece de verdade com contas anuais de vencimento
        // distante (IPVA, IPTU, seguro) — sem este estado, a tela fica em
        // branco e parece que o cadastro não salvou.
        <EmptyState
          icon={CalendarSearch}
          title="Nenhuma conta vence neste período"
          description="Você já tem contas cadastradas, mas nenhuma delas vence na janela mostrada aqui — dos últimos 2 meses até o fim do mês que vem. Contas anuais ou com vencimento mais distante (IPVA, IPTU, seguro) entram na lista conforme a data se aproxima."
        />
      ) : (
        grouped.map((group) => (
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
                  {b.status !== "pago" && (
                    <Button size="sm" variant="outline" onClick={() => setPagando(b)}>
                      Registrar pagamento
                    </Button>
                  )}
                  <span className="font-medium text-ink whitespace-nowrap">
                    {formatBRL(b.status === "pago" ? (b.paid_amount_cents ?? 0) : (b.amount_cents ?? 0))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {payableForm && (
        <PayableForm
          payable={payableForm === "new" ? undefined : payableForm}
          onClose={closePayableForm}
        />
      )}
      {pagando && <RegistrarPagamentoModal bill={pagando} onClose={() => setPagando(null)} />}
      {gerindo && (
        <PayableRulesPanel
          payables={payables}
          onClose={() => setGerindo(false)}
          onEdit={(p) => { setGerindo(false); setPayableForm(p); }}
        />
      )}
    </div>
  );
}
