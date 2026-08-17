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
/** `N pagamento` / `N pagamentos`, sem repetir o ternário em cada frase. */
function pluralizar(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export interface AvisoImportacao {
  tone: "success" | "warning" | "error" | "info";
  texto: string;
}

/**
 * Traduz o resultado de uma importação no aviso que a tela dá.
 *
 * Existe separada, e pura, por causa de uma regressão da Task 9: quando
 * TODOS os itens do lote falhavam, a rota respondia 200 e a tela chamava
 * `toast.success("0 pagamentos importados.")` — visto verde para fracasso
 * completo, com o bloco de falhas logo abaixo desmentindo o toast. O tom era
 * fixo; só a contagem variava.
 *
 * A regra agora é uma só: o tom acompanha o que ACONTECEU, não o fato de a
 * requisição ter voltado 200.
 *
 * `atualizados` conta como trabalho feito junto com `importados` — corrigir
 * o status de um estorno é exatamente o que a conferência existe para fazer,
 * e a versão antiga, que só olhava `importados`, anunciava "0 pagamentos
 * importados" para um lote que corrigiu meia dúzia de estornos.
 *
 * Pura também para poder ser testada sem navegador (não há um nesta
 * sessão): o componente só escolhe qual `toast.*` chamar a partir do `tone`.
 */
export function avisoDaImportacao(r: {
  importados: number;
  atualizados: number;
  falhas: unknown[];
  naoProcessados: number;
  pulados: number;
}): AvisoImportacao {
  const falhas = r.falhas.length;
  const gravou = r.importados + r.atualizados;

  const feitos: string[] = [];
  if (r.importados > 0) {
    feitos.push(pluralizar(r.importados, "pagamento importado", "pagamentos importados"));
  }
  if (r.atualizados > 0) {
    feitos.push(pluralizar(r.atualizados, "status corrigido", "status corrigidos"));
  }
  const falharam = pluralizar(falhas, "pagamento falhou", "pagamentos falharam");

  // Nada entrou e nada falhou tem DUAS causas opostas, e dizer a errada manda
  // o operador para o lado errado: se o teto segurou o lote, a saída é rodar
  // de novo; se os itens foram pulados de propósito (linha já existia, ou o
  // estorno recusou virar `approved` outra vez), não há o que fazer. Antes as
  // duas viravam "Nada foi importado nesta rodada.", redigido como se o teto
  // sempre tivesse sido a causa.
  if (gravou === 0 && falhas === 0) {
    if (r.pulados > 0 && r.naoProcessados === 0) {
      return {
        tone: "info",
        texto: `Nada a importar — ${pluralizar(r.pulados, "pagamento já estava correto aqui", "pagamentos já estavam corretos aqui")}.`,
      };
    }
    if (r.naoProcessados > 0) {
      return {
        tone: "info",
        texto: `Nada entrou nesta rodada — ${r.naoProcessados} ${r.naoProcessados === 1 ? "ficou" : "ficaram"} para a próxima. Confira de novo.`,
      };
    }
    return { tone: "info", texto: "Nada foi importado nesta rodada." };
  }
  if (gravou === 0) {
    return { tone: "error", texto: `Nada foi importado — ${falharam}.` };
  }
  if (falhas === 0) {
    return { tone: "success", texto: `${feitos.join(" · ")}.` };
  }
  return { tone: "warning", texto: `${feitos.join(" · ")} · ${falharam}.` };
}

const avisar: Record<AvisoImportacao["tone"], (texto: string) => void> = {
  success: (t) => toast.success(t),
  warning: (t) => toast.warning(t),
  error: (t) => toast.error(t),
  info: (t) => toast.info(t),
};

export function ReconciliarButton({ competencia }: { competencia: string }) {
  const router = useRouter();
  const [diff, setDiff] = useState<ReconciliacaoResultado | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function chamar(dry: boolean, token?: string): Promise<ReconciliacaoResultado> {
    const url = dry
      ? "/api/superadmin/payments/reconciliar?dry=true"
      : "/api/superadmin/payments/reconciliar";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // O `token` é o do conjunto que ESTA tela mostrou: a rota recusa importar
      // se o Mercado Pago mudou desde a conferência. Sem ele, o operador
      // confirmaria um número em vez de um conjunto.
      body: JSON.stringify(dry ? { competencia } : { competencia, token }),
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
    if (!diff) return;
    setErro(null);
    setImportando(true);
    try {
      const feito = await chamar(false, diff.token);
      setDiff(feito);
      const aviso = avisoDaImportacao(feito);
      avisar[aviso.tone](aviso.texto);
      // A página é server component: quem recalcula caixa, RBT12 e fila
      // fiscal com as linhas novas é o servidor, não este estado local.
      router.refresh();
    } catch (err) {
      setErro((err as Error).message);
      // A conferência anterior não vale mais: ou o Mercado Pago mudou (409),
      // ou parte do lote entrou. Deixar o diff velho na tela ofereceria de
      // novo "Importar N" com um N que já não é verdade. Obriga a conferir.
      setDiff(null);
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
        {diff.encontradosMp === 0
          ? "O Mercado Pago não tem nenhum pagamento neste período."
          : `${diff.jaRegistrados} pagamento${diff.jaRegistrados === 1 ? "" : "s"} do Mercado Pago já ${diff.jaRegistrados === 1 ? "está" : "estão"} registrado${diff.jaRegistrados === 1 ? "" : "s"} aqui. Nada faltando do lado do Mercado Pago.`}
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
          {diff.naoProcessados > 0 &&
            ` ${diff.naoProcessados} ficaram para a próxima rodada — confira de novo para importar o resto.`}
        </p>
      )}

      {diff.falhas.length > 0 && (
        <Bloco
          titulo={`${diff.falhas.length} pagamento${diff.falhas.length === 1 ? "" : "s"} que o Mercado Pago não devolveu na hora de importar`}
          resumo="O resto do lote entrou. Confira de novo para tentar só estes."
          tone="suspended"
        >
          {diff.falhas.map((f) => (
            <Linha
              key={f.mpPaymentId}
              titulo={`MP #${f.mpPaymentId}`}
              detalhe={f.motivo}
              valor="—"
            />
          ))}
        </Bloco>
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
          {diff.ignorados.map((i, idx) => (
            <Linha
              // `mpPaymentId` pode ser o placeholder "(sem id)" — o índice
              // desempata se vier mais de um.
              key={`${i.mpPaymentId}-${idx}`}
              titulo={`MP #${i.mpPaymentId}`}
              detalhe={i.motivo}
              valor={formatBRLFull(i.grossCents)}
            />
          ))}
        </Bloco>
      )}

      <p className="text-body-s text-n600">
        {diff.encontradosMp} pagamento{diff.encontradosMp === 1 ? "" : "s"} de {diff.competencia} no
        Mercado Pago · {diff.jaRegistrados} já
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
