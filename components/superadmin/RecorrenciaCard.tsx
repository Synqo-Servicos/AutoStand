import { TrendingUp } from "lucide-react";
import { Badge, Card, CardHeader, CardTitle, CardDescription, CardBody } from "@/components/ui";
import { formatBRLFull } from "@/lib/money";
import { getPlan } from "@/lib/plans";
import type { RecorrenciaSummary } from "@/lib/db/payments";

/**
 * Recorrência da base de assinantes — estado corrente (`tenants`), não
 * caixa do período. MRR pelo preço de tabela do plano ativo; inadimplentes
 * são tenants `past_due`.
 */
export function RecorrenciaCard({ recorrencia }: { recorrencia: RecorrenciaSummary }) {
  const planos = Object.entries(recorrencia.ativosPorPlano);
  const totalAtivos = planos.reduce((a, [, count]) => a + count, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-signal" />
          <CardTitle>Recorrência</CardTitle>
        </div>
        <CardDescription>Assinaturas ativas agora</CardDescription>
      </CardHeader>
      <CardBody className="space-y-4">
        <div>
          <p className="text-xs text-n600">MRR</p>
          <p className="text-2xl font-semibold text-ink tabular-nums">
            {formatBRLFull(recorrencia.mrrCents)}
          </p>
          <p className="text-xs text-n400 mt-0.5">{totalAtivos} assinatura{totalAtivos === 1 ? "" : "s"} ativa{totalAtivos === 1 ? "" : "s"}</p>
        </div>

        {planos.length === 0 ? (
          <p className="text-sm text-n400">Nenhuma assinatura ativa.</p>
        ) : (
          <ul className="space-y-1.5">
            {planos.map(([slug, count]) => (
              <li key={slug} className="flex items-center justify-between text-sm">
                <span className="text-n600">{getPlan(slug).name}</span>
                <span className="font-medium text-ink tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="pt-3 border-t border-n100 flex items-center justify-between">
          <span className="text-sm text-n600">Inadimplentes</span>
          <Badge tone={recorrencia.inadimplentes > 0 ? "pending" : "neutral"} dot size="sm">
            {recorrencia.inadimplentes}
          </Badge>
        </div>
      </CardBody>
    </Card>
  );
}
