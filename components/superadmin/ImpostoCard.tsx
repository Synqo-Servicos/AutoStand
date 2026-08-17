import { Landmark } from "lucide-react";
import { Badge, Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { formatBRLFull } from "@/lib/money";
import { LIMITE_SIMPLES_CENTS, type SimplesAnexo } from "@/lib/simples";

/**
 * Bloco de imposto do console financeiro.
 *
 * **Server Component de propósito.** Sem `"use client"`: quando o valor está
 * escondido ele não é renderizado, e como nada aqui vira payload de cliente,
 * o número não chega ao navegador por nenhum caminho — nem no HTML, nem no
 * flight data. A prop `valores` ser `null` (em vez de um booleano ao lado dos
 * números) é a mesma ideia levada ao tipo: quando o valor não pode aparecer,
 * ele **não existe** no componente.
 *
 * A regra de quem vê o quê mora em `showsTaxValue` (lib/finance-config.ts);
 * este arquivo só desenha os dois estados.
 */

/** Só existe quando o valor pode aparecer. */
export interface ImpostoValores {
  /** Alíquota efetiva como FRAÇÃO decimal (0,086 = 8,60%). */
  efetiva: number;
  /** Faixa da tabela do anexo, 1 a 6. */
  faixa: number;
  /** DAS estimado do mês, em centavos. */
  dasCents: number;
  /** Vencimento em `YYYY-MM-DD`. */
  vencimento: string;
}

export interface ImpostoCardProps {
  /** Competência de apuração, `YYYY-MM`. */
  competencia: string;
  /** Anexo configurado (`FINANCE_ANEXO`). */
  anexo: SimplesAnexo;
  /** Competência de abertura da empresa, `YYYY-MM`. */
  aberturaCompetencia: string;
  /**
   * Meses de atividade completados NO mês de apuração. `<= 0` significa
   * competência anterior à abertura: não há o que apurar, e o card diz isso
   * em vez de exibir zero (que seria lido como "não devo nada").
   */
  meses: number;
  /** RBT12 apurado, em centavos. `null` quando não há o que apurar. */
  rbt12Cents: number | null;
  /** Meses cuja receita alimentou a RBT12 (`YYYY-MM`), inclusive nas pontas. */
  janela: { de: string; ate: string } | null;
  /** O contador já validou o cálculo? (`FINANCE_TAX_VALIDATED`) */
  validado: boolean;
  /** `null` esconde o valor — é o estado "aguardando validação contábil". */
  valores: ImpostoValores | null;
}

/** `YYYY-MM` → `MM/YYYY`. Sem `Date`: string em, string out, sem fuso no meio. */
function mesBR(competencia: string): string {
  const [ano, mes] = competencia.split("-");
  return `${mes}/${ano}`;
}

/** `YYYY-MM-DD` → `DD/MM/YYYY`, pelo mesmo motivo. */
function dataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Fração decimal → percentual pt-BR. 4 casas porque a efetiva raramente cabe em 2. */
function percentBR(fracao: number): string {
  return `${(fracao * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}%`;
}

export function ImpostoCard({
  competencia,
  anexo,
  aberturaCompetencia,
  meses,
  rbt12Cents,
  janela,
  validado,
  valores,
}: ImpostoCardProps) {
  const emOperacao = meses >= 1 && rbt12Cents !== null;
  // Até o 12º mês a receita é ANUALIZADA (média × 12); do 13º em diante vale a
  // soma real dos 12 meses anteriores. Muda o que o número significa, então
  // aparece na tela.
  const regime = meses <= 12 ? "anualizada" : "acumulada";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Landmark className="h-4 w-4 text-signal" />
          <CardTitle>Imposto</CardTitle>
          <EstadoBadge emOperacao={emOperacao} validado={validado} temValores={valores !== null} />
        </div>
        <CardDescription>Simples Nacional · competência {mesBR(competencia)}</CardDescription>
      </CardHeader>

      <CardBody>
        {!emOperacao ? (
          <p className="text-body-s text-n600">
            A empresa abriu em {mesBR(aberturaCompetencia)}. Não há apuração para{" "}
            {mesBR(competencia)}.
          </p>
        ) : (
          <>
            <dl className="divide-y divide-n100 text-sm">
              <Row label={`RBT12 ${regime}`} value={formatBRLFull(rbt12Cents)} />
              <Row label="Anexo configurado" value={`Anexo ${anexo}`} />
              <Row
                label="Em operação desde"
                value={`${mesBR(aberturaCompetencia)} · ${meses}º mês`}
              />
              {janela && (
                <Row
                  label="Receita considerada"
                  value={
                    janela.de === janela.ate
                      ? mesBR(janela.de)
                      : `${mesBR(janela.de)} a ${mesBR(janela.ate)}`
                  }
                  muted
                />
              )}

              {valores && (
                <>
                  <Row
                    label={`Alíquota efetiva (faixa ${valores.faixa})`}
                    value={percentBR(valores.efetiva)}
                  />
                  <Row label="DAS estimado" value={formatBRLFull(valores.dasCents)} bold />
                  <Row label="Vencimento" value={dataBR(valores.vencimento)} muted />
                </>
              )}
            </dl>

            <Rodape
              temValores={valores !== null}
              validado={validado}
              acimaDoLimite={rbt12Cents > LIMITE_SIMPLES_CENTS}
            />
          </>
        )}
      </CardBody>
    </Card>
  );
}

function EstadoBadge({
  emOperacao,
  validado,
  temValores,
}: {
  emOperacao: boolean;
  validado: boolean;
  temValores: boolean;
}) {
  if (!emOperacao) {
    return <Badge tone="neutral" size="sm">Fora do período de operação</Badge>;
  }
  if (!temValores) {
    return <Badge tone="pending" size="sm" dot>Aguardando validação contábil</Badge>;
  }
  if (!validado) {
    return <Badge tone="pending" size="sm" dot>Cálculo não validado</Badge>;
  }
  return <Badge tone="available" size="sm" dot>Validado pela contabilidade</Badge>;
}

/**
 * O rodapé carrega as ressalvas que o número não pode andar sem — e no estado
 * escondido explica por que os insumos aparecem e o valor não.
 */
function Rodape({
  temValores,
  validado,
  acimaDoLimite,
}: {
  temValores: boolean;
  validado: boolean;
  acimaDoLimite: boolean;
}) {
  return (
    <div className="mt-4 space-y-1.5 border-t border-n100 pt-3 text-body-s text-n600">
      {!temValores ? (
        <p>
          DAS e alíquota ficam ocultos até a contabilidade validar o cálculo. Os insumos
          acima são o que alimenta a conta — confira-os com o contador.
        </p>
      ) : (
        <>
          {!validado && (
            <p className="text-warning-dark">
              Cálculo ainda <strong>não validado</strong> pela contabilidade — visível para o
              contador conferir.
            </p>
          )}
          <p>
            Valor <strong>estimado</strong>, para provisionar. A apuração que vale é a do
            PGDAS-D: ela segrega receitas, aplica sublimite municipal, retenções de ISS e o
            Fator R do mês, nada disso considerado aqui.
          </p>
          {/*
            Esta ressalva vem PRIMEIRO entre as diferenças porque é a única que
            muda a BASE, e não a alíquota: as outras ajustam o quanto se paga
            sobre a mesma receita, esta muda qual receita entra. Sem ela o
            rodapé lia como lista exaustiva, o que tornava a divergência do
            PGDAS-D mais difícil de notar, não menos.
          */}
          <p>
            A base aqui é o que <strong>entrou</strong> no período (regime de caixa). O Simples
            apura por <strong>competência</strong> salvo opção formal pelo caixa — se a empresa
            não fez essa opção, este número diverge do PGDAS-D por construção, não por erro.
          </p>
          <p>Vence no dia 20 do mês seguinte, ou no próximo dia útil.</p>
          {acimaDoLimite && (
            <p className="text-danger">
              RBT12 acima do teto do Simples ({formatBRLFull(LIMITE_SIMPLES_CENTS)}): a
              empresa está fora do regime e esta estimativa deixa de valer.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <dt className={bold ? "font-semibold text-ink" : "text-n600"}>{label}</dt>
      <dd
        className={`tabular-nums ${bold ? "font-semibold text-ink" : muted ? "text-n600" : "text-ink"}`}
      >
        {value}
      </dd>
    </div>
  );
}
