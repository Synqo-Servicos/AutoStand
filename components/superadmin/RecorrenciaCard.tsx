import { TrendingUp } from "lucide-react";
import { Badge, Card, CardHeader, CardTitle, CardDescription, CardBody } from "@/components/ui";
import { formatBRLFull } from "@/lib/money";
import { getPlan } from "@/lib/plans";
import type { RecorrenciaSummary } from "@/lib/db/payments";

/**
 * Recorrência da base de assinantes — estado corrente (`tenants`), não caixa
 * do período.
 *
 * O MRR é o que se COBRA, não o preço de tabela: cupom aplicado, loja
 * suspensa fora, assinatura sem plano fora. Por isso o card mostra o que foi
 * excluído — um MRR menor que o número de assinaturas sugere, sem dizer por
 * quê, vira desconfiança do número inteiro.
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

        <ForaDoMrr
          cortesias={recorrencia.cortesias}
          suspensos={recorrencia.suspensos}
          semPlano={recorrencia.semPlano}
        />
      </CardBody>
    </Card>
  );
}

/**
 * O que existe na base mas não entra no MRR.
 *
 * Some quando não há nada a declarar — o card não deve carregar linha de
 * exceção que não aconteceu. Quando há, cada linha diz o MOTIVO da exclusão,
 * porque a pergunta que ela responde é "por que o MRR é menor do que o número
 * de assinaturas ativas sugere".
 */
function ForaDoMrr({
  cortesias, suspensos, semPlano,
}: { cortesias: number; suspensos: number; semPlano: number }) {
  const linhas = [
    cortesias > 0 && { chave: "cortesias", rotulo: "Cortesia (cupom zera a mensalidade)", valor: cortesias },
    suspensos > 0 && { chave: "suspensos", rotulo: "Suspensas com assinatura ativa", valor: suspensos },
    semPlano > 0 && { chave: "semPlano", rotulo: "Ativas sem plano definido", valor: semPlano },
  ].filter(Boolean) as { chave: string; rotulo: string; valor: number }[];

  if (linhas.length === 0) return null;

  return (
    <div className="pt-3 border-t border-n100">
      <p className="text-xs font-medium text-n700">Fora do MRR</p>
      <ul className="mt-1.5 space-y-1">
        {linhas.map((l) => (
          <li key={l.chave} className="flex items-center justify-between text-sm">
            <span className="text-n600">{l.rotulo}</span>
            <span className="font-medium text-ink tabular-nums">{l.valor}</span>
          </li>
        ))}
      </ul>
      {semPlano > 0 && (
        <p className="mt-2 text-xs text-warning-dark">
          Assinatura ativa sem plano é inconsistência de cadastro — não dá para saber
          quanto cobrar. Vale conferir no cadastro da loja.
        </p>
      )}
    </div>
  );
}
