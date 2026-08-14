import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { BillWithPayable } from "@/lib/db/payables";
import { formatBRLFull } from "@/lib/money";

/**
 * Só aparece quando há algo acionável hoje: conta atrasada ou vencendo
 * hoje. Banner permanente vira paisagem e para de ser lido.
 *
 * `aguardando_conciliacao` (débito automático já vencido, mas ainda não
 * confirmado) fica de fora de propósito — o sistema não sabe se o débito
 * ocorreu, e tratar como inadimplência geraria alarme falso todo mês.
 */
export function ContasVencendoBanner({ bills }: { bills: BillWithPayable[] }) {
  const urgentes = bills.filter(
    (b) => b.status === "atrasado" || b.status === "vence_hoje",
  );
  if (urgentes.length === 0) return null;

  const atrasadas = urgentes.filter((b) => b.status === "atrasado").length;
  const venceHoje = urgentes.length - atrasadas;
  const total = urgentes.reduce((acc, b) => acc + (b.amount_cents ?? 0), 0);

  // O valor exibido sempre soma TODO `urgentes` (atrasadas + vencendo hoje);
  // o título precisa contar exatamente o mesmo conjunto, não só as atrasadas.
  const titulo =
    atrasadas > 0 && venceHoje > 0
      ? `${urgentes.length} contas atrasadas ou vencendo hoje`
      : atrasadas > 0
        ? `${atrasadas} conta${atrasadas > 1 ? "s" : ""} atrasada${atrasadas > 1 ? "s" : ""}`
        : `${venceHoje} conta${venceHoje > 1 ? "s" : ""} vencendo hoje`;

  return (
    <Link
      href="/admin/financeiro?tab=contas"
      className="flex items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 mb-6 sm:mb-8 hover:bg-danger/10 transition-colors"
    >
      <AlertTriangle className="w-5 h-5 text-danger shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink text-sm">{titulo}</p>
        <p className="text-xs text-n600">
          {formatBRLFull(total)} · toque para ver e registrar o pagamento
        </p>
      </div>
    </Link>
  );
}
