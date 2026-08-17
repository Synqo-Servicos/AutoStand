"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, RefreshCcw } from "lucide-react";
import { formatBRLFull } from "@/lib/money";
import type { ReconciliacaoResultado } from "@/lib/reconciliacao";
import {
  Button, Card, CardBody, CardDescription, CardHeader, CardTitle, toast,
} from "@/components/ui";

/**
 * Reconciliação com o Mercado Pago, em duas etapas — nunca importa no clique.
 *
 * O primeiro botão só CONFERE (`?dry=true`): a rota compara o período com o
 * MP e devolve a diferença sem gravar nada. Só depois de o operador ver
 * quantos pagamentos faltam, de quais lojas e quanto em bruto é que aparece o
 * botão de importar.
 *
 * A razão não é ergonomia: webhook perdido é informação sobre o sistema.
 * Importar em silêncio consertaria o número e esconderia que o caminho
 * principal falhou — e é o caminho principal que precisa ser consertado.
 */
export function ReconciliarButton({ competencia }: { competencia: string }) {
  const router = useRouter();
  const [diff, setDiff] = useState<ReconciliacaoResultado | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function chamar(dry: boolean): Promise<ReconciliacaoResultado> {
    const url = dry
      ? "/api/superadmin/payments/reconciliar?dry=true"
      : "/api/superadmin/payments/reconciliar";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competencia }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Não foi possível falar com o Mercado Pago.");
    return data as ReconciliacaoResultado;
  }

  async function conferir() {
    setErro(null);
    setConferindo(true);
    try {
      setDiff(await chamar(true));
    } catch (err) {
      setDiff(null);
      setErro((err as Error).message);
    } finally {
      setConferindo(false);
    }
  }

  async function importar() {
    setErro(null);
    setImportando(true);
    try {
      const feito = await chamar(false);
      setDiff(feito);
      toast.success(
        feito.importados === 1
          ? "1 pagamento importado."
          : `${feito.importados} pagamentos importados.`,
      );
      // A página é server component: quem recalcula caixa, RBT12 e fila
      // fiscal com as linhas novas é o servidor, não este estado local.
      router.refresh();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setImportando(false);
    }
  }

  const aImportar = diff ? diff.faltantes.length + diff.divergentes.length : 0;
  const precisaConfirmar = diff !== null && diff.dry && aImportar > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <RefreshCcw className="h-4 w-4 text-signal" />
          <CardTitle>Conferência com o Mercado Pago</CardTitle>
        </div>
        <CardDescription>
          Compara os pagamentos de {competencia} com o que o Mercado Pago registrou.
          Nada é gravado até você confirmar.
        </CardDescription>
      </CardHeader>

      <CardBody>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            loading={conferindo}
            disabled={importando}
            onClick={conferir}
          >
            Conferir {competencia}
          </Button>

          {precisaConfirmar && (
            <>
              <Button size="sm" loading={importando} onClick={importar}>
                Importar {aImportar} pagamento{aImportar === 1 ? "" : "s"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={importando}
                onClick={() => setDiff(null)}
              >
                Cancelar
              </Button>
            </>
          )}
        </div>

        {erro && <p className="mt-3 text-body-s text-danger">{erro}</p>}
        {diff && <Resultado diff={diff} />}
      </CardBody>
    </Card>
  );
}

function Resultado({ diff }: { diff: ReconciliacaoResultado }) {
  const nadaAFazer = diff.faltantes.length === 0 && diff.divergentes.length === 0;

  if (nadaAFazer && diff.ignorados.length === 0) {
    return (
      <p className="mt-4 flex items-center gap-2 text-body-s text-n700">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
        {diff.consultadosMp === 0
          ? "O Mercado Pago não tem nenhum pagamento neste período."
          : `Tudo conferido — ${diff.jaRegistrados} pagamento${diff.jaRegistrados === 1 ? "" : "s"} do Mercado Pago já ${diff.jaRegistrados === 1 ? "está" : "estão"} registrado${diff.jaRegistrados === 1 ? "" : "s"} aqui.`}
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {!diff.dry && (
        <p className="text-body-s text-n700">
          {diff.importados} pagamento{diff.importados === 1 ? "" : "s"} importado
          {diff.importados === 1 ? "" : "s"}
          {diff.atualizados > 0 && ` · ${diff.atualizados} status corrigido${diff.atualizados === 1 ? "" : "s"}`}.
        </p>
      )}

      {diff.faltantes.length > 0 && (
        <Bloco
          titulo={
            diff.dry
              ? `${diff.faltantes.length} pagamento${diff.faltantes.length === 1 ? "" : "s"} no Mercado Pago que não ${diff.faltantes.length === 1 ? "está" : "estão"} aqui`
              : "Pagamentos encontrados nesta conferência"
          }
          resumo={`${formatBRLFull(diff.totalFaltanteCents)} em bruto`}
          tone="pending"
        >
          {diff.faltantes.map((f) => (
            <Linha
              key={f.mpPaymentId}
              titulo={f.tenantName}
              detalhe={`${f.status} · ${dataCurta(f.paidAt)} · MP #${f.mpPaymentId}`}
              valor={formatBRLFull(f.grossCents)}
            />
          ))}
        </Bloco>
      )}

      {diff.divergentes.length > 0 && (
        <Bloco
          titulo={`${diff.divergentes.length} pagamento${diff.divergentes.length === 1 ? "" : "s"} com status diferente do Mercado Pago`}
          resumo="Tipicamente um estorno que o webhook não entregou"
          tone="suspended"
        >
          {diff.divergentes.map((d) => (
            <Linha
              key={d.mpPaymentId}
              titulo={d.tenantName}
              detalhe={`aqui: ${d.statusLocal} → no Mercado Pago: ${d.status} · MP #${d.mpPaymentId}`}
              valor={formatBRLFull(d.grossCents)}
            />
          ))}
        </Bloco>
      )}

      {diff.ignorados.length > 0 && (
        <Bloco
          titulo={`${diff.ignorados.length} pagamento${diff.ignorados.length === 1 ? "" : "s"} que a importação não consegue gravar`}
          resumo="Aparecem aqui em vez de sumir — resolva pelo banco se for cobrança de assinatura"
          tone="neutral"
        >
          {diff.ignorados.map((i) => (
            <Linha
              key={i.mpPaymentId}
              titulo={`MP #${i.mpPaymentId}`}
              detalhe={i.motivo}
              valor={formatBRLFull(i.grossCents)}
            />
          ))}
        </Bloco>
      )}

      <p className="text-body-s text-n600">
        {diff.consultadosMp} pagamento{diff.consultadosMp === 1 ? "" : "s"} consultado
        {diff.consultadosMp === 1 ? "" : "s"} no Mercado Pago · {diff.jaRegistrados} já
        {diff.jaRegistrados === 1 ? " estava" : " estavam"} registrado
        {diff.jaRegistrados === 1 ? "" : "s"} aqui.
      </p>
    </div>
  );
}

const toneIcon: Record<Tone, string> = {
  pending: "text-warning",
  suspended: "text-danger",
  neutral: "text-n500",
};

type Tone = "pending" | "suspended" | "neutral";

function Bloco({
  titulo, resumo, tone, children,
}: {
  titulo: string;
  resumo: string;
  tone: Tone;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="flex items-start gap-2 font-medium text-ink">
        <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${toneIcon[tone]}`} />
        {titulo}
      </p>
      <p className="mt-0.5 pl-6 text-body-s text-n600">{resumo}</p>
      <ul className="mt-2 divide-y divide-n100 rounded-md border border-n200">{children}</ul>
    </section>
  );
}

function Linha({ titulo, detalhe, valor }: { titulo: string; detalhe: string; valor: string }) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{titulo}</p>
        <p className="truncate text-body-s text-n600">{detalhe}</p>
      </div>
      <span className="shrink-0 tabular-nums font-medium text-ink">{valor}</span>
    </li>
  );
}

/**
 * Dia/mês do pagamento pela hora de São Paulo. `toLocaleDateString` com
 * `timeZone` explícito, nunca `toISOString().slice(...)`: o MP devolve a data
 * com offset, e recortar o ISO em UTC joga um pagamento das 21h de 31/08 para
 * 01/09 na tela.
 */
function dataCurta(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "data desconhecida";
  return new Date(t).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });
}
