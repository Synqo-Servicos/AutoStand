import { AlertTriangle, Wallet } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from "@/components/ui";
import { formatBRLFull } from "@/lib/money";

export interface CaixaSummary {
  gross: number;
  fee: number;
  netBeforeTax: number;
  /**
   * Quantos pagamentos aprovados do período entraram SEM a taxa do Mercado
   * Pago. Eles somam no bruto normalmente, mas contribuem zero para a taxa —
   * então o líquido acima é um TETO, não um valor. Ver `sumCaixa`.
   */
  incompletos: number;
  /**
   * Estornos e chargebacks da competência. Não entram em nenhum dos números
   * acima — a razão de existirem aqui é justamente essa: eles se subtraem
   * sozinhos, retroativamente, inclusive de mês já apurado, e antes disto o
   * console não dava nenhum sinal de que a subtração aconteceu.
   */
  estornos: number;
  estornosCents: number;
}

/**
 * Caixa do período: bruto aprovado, taxa do Mercado Pago, e o resultado —
 * rotulado **"Líquido antes de imposto"**, nunca "líquido" sozinho. O bloco
 * de imposto chega na Task 8 e nasce desligado; "líquido" puro seria lido
 * como dinheiro disponível para saque, o que ele não é enquanto o imposto
 * não foi retido.
 *
 * **Sempre `formatBRLFull`, nunca `formatBRL`.** O segundo arredonda para
 * real inteiro (R$ 249,90 → "R$ 250") e estes números são copiados para
 * dentro de uma NFS-e. Ver lib/money.ts.
 *
 * Quando há pagamento com a taxa desconhecida (`incompletos > 0`), o card
 * diz isso ANTES dos números e qualifica os dois que estão errados: a taxa
 * exibida é um piso e o líquido, um teto. Sem isso, uma taxa que não veio do
 * MP aparece como "− R$ 0,00" e o líquido sai superestimado nela inteira,
 * sem marca nenhuma na tela — que era o estado antes desta correção, com a
 * coluna `incomplete` gravada e lida por ninguém.
 */
export function CaixaCard({ competencia, caixa }: { competencia: string; caixa: CaixaSummary }) {
  const taxaIncerta = caixa.incompletos > 0;

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
        {taxaIncerta && <AvisoTaxaIncerta quantidade={caixa.incompletos} />}
        <dl className="divide-y divide-n100 text-sm">
          <Row label="Bruto" value={formatBRLFull(caixa.gross)} />
          <Row
            label="Taxa do Mercado Pago"
            value={`− ${formatBRLFull(caixa.fee)}`}
            nota={taxaIncerta ? "no mínimo" : undefined}
            muted
          />
          <Row
            label="Líquido antes de imposto"
            value={formatBRLFull(caixa.netBeforeTax)}
            nota={taxaIncerta ? "no máximo" : undefined}
            bold
          />
          {caixa.estornos > 0 && (
            <Row
              label={`Estornado no período (${caixa.estornos})`}
              value={`− ${formatBRLFull(caixa.estornosCents)}`}
              nota="já fora dos números acima"
              muted
            />
          )}
        </dl>
        {caixa.estornos > 0 && (
          <p className="mt-3 text-body-s text-n600">
            Estorno já saiu do bruto e da base do imposto, inclusive em competência
            fechada. Se alguma dessas cobranças já virou nota, ela pode precisar de
            cancelamento.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * Acima das linhas de propósito: quem lê este card copia o líquido para uma
 * nota fiscal, e precisa saber que ele não é confiável ANTES de copiar, não
 * depois. Diz também o que fazer — o número certo existe, só não está aqui.
 */
function AvisoTaxaIncerta({ quantidade }: { quantidade: number }) {
  const plural = quantidade === 1 ? "pagamento" : "pagamentos";
  const entrou = quantidade === 1 ? "entrou" : "entraram";

  return (
    <div className="mb-4 flex items-start gap-2 rounded-md bg-warning/12 p-3 ring-1 ring-inset ring-warning/30">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-dark" />
      <p className="text-body-s text-ink">
        {quantidade} {plural} {entrou} sem a taxa do Mercado Pago e {quantidade === 1 ? "conta" : "contam"}{" "}
        como taxa zero aqui. A taxa real é maior e o líquido abaixo está
        superestimado — confira no Mercado Pago antes de emitir a nota.
      </p>
    </div>
  );
}

function Row({
  label, value, nota, muted, bold,
}: {
  label: string;
  value: string;
  nota?: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <dt className={bold ? "font-semibold text-ink" : "text-n600"}>{label}</dt>
      <dd className={`text-right tabular-nums ${bold ? "font-semibold text-ink" : muted ? "text-n600" : "text-ink"}`}>
        {value}
        {nota && <span className="ml-1.5 text-body-s font-normal text-warning-dark">({nota})</span>}
      </dd>
    </div>
  );
}
