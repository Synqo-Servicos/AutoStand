"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CalendarSearch, CheckCircle2, Plus } from "lucide-react";
import type { PayableRow } from "@/lib/schema";
import type { BillWithPayable } from "@/lib/db/payables";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/constants";
import { formatBRLFull } from "@/lib/money";
import { Button, EmptyState } from "@/components/ui";
import { PayableForm } from "./PayableForm";
import { PayableRulesPanel } from "./PayableRulesPanel";
import { RegistrarPagamentoModal } from "./RegistrarPagamentoModal";

// `backlog: true` = grupo que pode acumular vencimentos antigos sem limite
// (dívida vencida não tem piso de data — ver buildBills em lib/recurring.ts).
// Os outros três são limitados pela janela e nunca passam de poucos itens.
const GROUPS = [
  { id: "atrasado",  label: "Atrasadas",          tone: "text-danger", backlog: true },
  { id: "vence_hoje", label: "Vencem hoje",       tone: "text-warning", backlog: false },
  { id: "a_vencer",  label: "Próximas",           tone: "text-ink", backlog: false },
  { id: "aguardando_conciliacao", label: "Débito automático — confirmar", tone: "text-n600", backlog: true },
  { id: "pago",      label: "Pagas",              tone: "text-n500", backlog: false },
] as const;

/**
 * Quantos vencimentos atrasados ficam abertos antes de recolher o resto.
 *
 * Uma conta mensal esquecida há três anos tem 36 vencimentos em aberto:
 * listar os 36 é tão inútil quanto listar zero. Mostramos os mais recentes
 * e recolhemos os anteriores atrás de um botão que diz quantos são e
 * quanto somam. Recolhido, não escondido: o contador e o total continuam
 * visíveis, o cabeçalho do grupo conta todos, e um clique traz cada linha
 * de volta com seu botão de "Registrar pagamento".
 */
const BACKLOG_PREVIEW = 5;

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
  const [expandidos, setExpandidos] = useState<string[]>([]);

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
        {/* "na janela" saiu do rótulo de propósito: o total agora inclui TODA
            ocorrência vencida e não paga, inclusive a anterior à janela e a de
            conta desativada. O número é a dívida em aberto, não um recorte. */}
        <p className="text-sm text-n600">
          Total em aberto: <strong className="text-ink">{formatBRLFull(totalAberto)}</strong>
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

      {/* `payables` traz só as regras ativas. Uma loja com a conta desativada
          e uma parcela vencida em aberto tem `payables.length === 0` e
          `bills.length > 0` — checar só o cadastro esconderia a dívida atrás
          do estado "nenhuma conta cadastrada". */}
      {payables.length === 0 && bills.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nenhuma conta cadastrada"
          description="Cadastre aluguel, energia, impostos e outras contas para receber aviso antes do vencimento."
        />
      ) : grouped.length === 0 ? (
        // Há contas cadastradas e nada em aberto: nenhuma ocorrência cai na
        // janela exibida (defaultWindow em lib/recurring.ts: dos últimos 2
        // meses até o fim do mês que vem). Acontece de verdade com contas
        // anuais de vencimento distante (IPVA, IPTU, seguro) — sem este
        // estado, a tela fica em branco e parece que o cadastro não salvou.
        // Vencimento atrasado e não pago NUNCA cai aqui: não tem piso de data.
        <EmptyState
          icon={CalendarSearch}
          title="Nenhuma conta vence neste período"
          description="Você não tem nada em aberto. As contas cadastradas só vencem depois da janela mostrada aqui — dos últimos 2 meses até o fim do mês que vem. Contas anuais ou com vencimento mais distante (IPVA, IPTU, seguro) entram na lista conforme a data se aproxima."
        />
      ) : (
        grouped.map((group) => {
          const recolhiveis = group.backlog && !expandidos.includes(group.id)
            ? group.items.length - BACKLOG_PREVIEW
            : 0;
          // `bills` chega ordenado por vencimento crescente, então os
          // recolhidos são sempre os mais antigos — o botão fica no topo da
          // lista, como um "carregar anteriores".
          const recolhidos = recolhiveis > 0 ? group.items.slice(0, recolhiveis) : [];
          const visiveis = group.items.slice(recolhidos.length);
          const somaRecolhida = recolhidos.reduce((acc, b) => acc + (b.amount_cents ?? 0), 0);

          return (
            <section key={group.id} className="space-y-2">
              <h3 className={`text-eyebrow ${group.tone}`}>
                {group.label} · {group.items.length}
              </h3>
              <ul className="rounded-xl border border-n200 bg-white divide-y divide-n100">
                {recolhidos.length > 0 && (
                  <li>
                    <button
                      type="button"
                      onClick={() => setExpandidos((prev) => [...prev, group.id])}
                      className="w-full text-left px-4 py-3 text-sm text-n600 hover:bg-n50 transition-colors cursor-pointer"
                    >
                      Mostrar {recolhidos.length} vencimento{recolhidos.length > 1 ? "s" : ""} mais
                      antigo{recolhidos.length > 1 ? "s" : ""}
                      {somaRecolhida > 0 && ` · ${formatBRLFull(somaRecolhida)}`}
                    </button>
                  </li>
                )}
                {visiveis.map((b) => (
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
                      {formatBRLFull(b.status === "pago" ? (b.paid_amount_cents ?? 0) : (b.amount_cents ?? 0))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
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
