import { Wallet } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from "@/components/ui";
import { formatBRLFull } from "@/lib/money";

export interface CaixaSummary {
  gross: number;
  fee: number;
  netBeforeTax: number;
}

/**
 * Caixa do período: bruto aprovado, taxa do Mercado Pago, e o resultado —
 * rotulado **"Líquido antes de imposto"**, nunca "líquido" sozinho. O bloco
 * de imposto chega na Task 8 e nasce desligado; "líquido" puro seria lido
 * como dinheiro disponível para saque, o que ele não é enquanto o imposto
 * não foi retido.
 */
export function CaixaCard({ competencia, caixa }: { competencia: string; caixa: CaixaSummary }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-signal" />
          <CardTitle>Caixa</CardTitle>
        </div>
        <CardDescription>Pagamentos aprovados em {competencia}</CardDescription>
      </CardHeader>
      <CardBody>
        <dl className="divide-y divide-n100 text-sm">
          <Row label="Bruto" value={formatBRLFull(caixa.gross)} />
          <Row label="Taxa do Mercado Pago" value={`− ${formatBRLFull(caixa.fee)}`} muted />
          <Row label="Líquido antes de imposto" value={formatBRLFull(caixa.netBeforeTax)} bold />
        </dl>
      </CardBody>
    </Card>
  );
}

function Row({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <dt className={bold ? "font-semibold text-ink" : "text-n600"}>{label}</dt>
      <dd className={`tabular-nums ${bold ? "font-semibold text-ink" : muted ? "text-n600" : "text-ink"}`}>
        {value}
      </dd>
    </div>
  );
}
