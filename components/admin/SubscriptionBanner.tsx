import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * Banner de pendência — exibido no topo do painel quando a loja não está
 * `active`. O lojista pode usar o painel normalmente; só o site público
 * fica fora do ar até a ativação.
 */
export function SubscriptionBanner() {
  return (
    <div className="flex items-center gap-3 border-b border-warning/40 bg-warning/15 px-6 py-3">
      <AlertTriangle className="h-4 w-4 shrink-0 text-ink" />
      <p className="text-body-s text-ink">
        <strong>Assinatura pendente.</strong> Seu site público está fora do ar até a
        ativação — mas você já pode preparar estoque, marca e layout por aqui.
      </p>
      <Link
        href="/admin/assinatura"
        className="ml-auto shrink-0 text-body-s font-semibold text-ink underline"
      >
        Ver assinatura
      </Link>
    </div>
  );
}
