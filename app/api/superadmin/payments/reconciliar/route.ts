import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "crypto";
import MercadoPagoConfig, { Payment } from "mercadopago";
import { ApiError, parseBody } from "@/lib/api";
import { withFinanceAccess } from "@/lib/finance-access";
import {
  getPaymentByMpId, getTenantById, listPaymentsByPeriod, periodBounds,
  recordPayment, updatePayment, type UpdatePaymentInput,
} from "@/lib/db";
import {
  computeFeeAndNet, derivePaidAt, grossCentsOf, shouldOverwriteStatus,
} from "@/lib/mp-payment";
import {
  assinaturaDiferenca, classificarDiferenca, dentroDaCompetencia,
  type CandidatoMp, type Diferenca, type ItemFalha, type ItemIgnorado,
  type ReconciliacaoResultado,
} from "@/lib/reconciliacao";
import { reconciliarInputSchema } from "@/lib/validation";

/**
 * Reconciliação de pagamentos — a rede embaixo do webhook.
 *
 * O webhook é o caminho principal e ele PERDE evento: o Mercado Pago pode não
 * entregar a notificação, e a app pode estar no meio de um deploy quando ela
 * chega. Sem esta rota, o único sintoma seria um mês fechando com receita
 * menor do que a real — descoberto, se descoberto, no fechamento contábil.
 *
 * DUAS ETAPAS, NUNCA UMA
 * ======================
 * Com `?dry=true` a rota só compara e devolve a diferença; sem o parâmetro,
 * importa. Não é ergonomia — é que webhook perdido é INFORMAÇÃO SOBRE O
 * SISTEMA, não só uma linha faltando. Importar no clique esconderia que o
 * caminho principal falhou; mostrar o diff primeiro obriga alguém a ver
 * quantos pagamentos o webhook deixou passar, e de quem.
 *
 * ACESSO
 * ======
 * `withFinanceAccess` (super-admin **e** contador), não `withSuperAdmin` — é
 * uma rota do financeiro (ver lib/finance-access.ts). A gravação que ela faz
 * não cria dinheiro: copia para cá um fato que já existe no Mercado Pago, e
 * o contador é exatamente quem precisa que o mês feche completo. Toda a
 * proteção mora aqui dentro: rota de API não passa por layout nenhum.
 */

/** Página da busca no MP. 50 é o suficiente para um mês inteiro em 1 chamada. */
const MP_PAGE_SIZE = 50;

/**
 * Teto de páginas. Existe para não girar para sempre se o MP devolver
 * `paging` inconsistente — e, ao ser atingido, ABORTA em vez de truncar: um
 * diff pela metade faria o operador importar "tudo o que falta" achando que
 * fechou o mês.
 */
const MP_MAX_PAGES = 20;

/**
 * Folga de cada lado da janela pedida ao MP. 24 h cobre qualquer offset que o
 * recurso possa trazer — ver a docstring de `buscarNoMp`.
 */
const MP_FOLGA_MS = 24 * 60 * 60 * 1000;

/**
 * Teto de itens gravados por execução. O que sobra fica declarado em
 * `naoProcessados` e entra na rodada seguinte — a reconciliação é idempotente,
 * repetir é barato.
 *
 * Sem teto seriam até `MP_MAX_PAGES * MP_PAGE_SIZE` (1000) chamadas ao MP numa
 * função com timeout: ela estouraria no meio e o operador não saberia o que
 * entrou. Um teto explícito troca "falha opaca" por "progresso parcial
 * declarado".
 */
const MAX_ITENS_POR_RODADA = 100;

/**
 * Quantos itens do lote são processados em paralelo. Baixo de propósito: o
 * limite prático não é a nossa CPU, é o rate limit do MP — e um 429 aqui vira
 * item pulado, não lote perdido.
 */
const CONCORRENCIA_MP = 5;

/**
 * O lote faz uma chamada ao MP por item. O default de duração de função da
 * Vercel é curto demais para isso; sem este export, o teto acima não adianta.
 */
export const maxDuration = 60;

function getMpClient() {
  return new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! });
}

/**
 * `?dry=true` simula; sem o parâmetro, importa (o contrato do plano).
 *
 * Qualquer OUTRO valor (`dry=sim`, `dry=1`, `dry=`) também simula: o lado
 * seguro de um erro de digitação na querystring é não escrever no banco. Só
 * `false`/`0` explícitos, ou a ausência do parâmetro, autorizam a gravação.
 */
function isDryRun(req: NextRequest): boolean {
  const raw = new URL(req.url).searchParams.get("dry");
  if (raw === null) return false;
  const v = raw.trim().toLowerCase();
  return !(v === "false" || v === "0");
}

/** O que o `/search` devolve e nós usamos. Resumo — não traz `fee_details`. */
interface MpSearchResult {
  id?: string | number;
  status?: string;
  transaction_amount?: number;
  date_approved?: string;
  date_created?: string;
  external_reference?: string;
}

/**
 * `GET /v1/payments/search` na janela da competência.
 *
 * Parâmetros (documentação do MP, "Search payments"):
 *  - `sort=date_approved` + `criteria=asc` — ordenação estável entre páginas;
 *  - `range=date_approved` — a janela recorta pela data de APROVAÇÃO, que é a
 *    mesma que vira `payments.paid_at`. Com `range=date_created`, um pagamento
 *    criado em 31/07 e aprovado em 01/08 seria buscado em julho e gravado em
 *    agosto, e nenhuma reconciliação fecharia;
 *  - `begin_date`/`end_date` — ISO-8601, com **um dia de folga de cada lado**
 *    da competência. A folga não é preguiça: o MP filtra por INSTANTE, e a
 *    competência desta base é RELÓGIO DE PAREDE (`paid_at` é `timestamp` sem
 *    time zone — ver `dentroDaCompetencia` em lib/reconciliacao.ts). Pedir ao
 *    MP exatamente `[00:00Z do dia 1º, 00:00Z do dia 1º seguinte)` deixaria de
 *    fora o pagamento das 22:00 de 31/08 em São Paulo, que o banco conta em
 *    agosto — e ele não voltaria da busca de agosto nem para ser mostrado como
 *    faltante. Com a folga ele volta, e quem recorta é `dentroDaCompetencia`,
 *    pelo mesmo relógio do banco. O custo é alguns resultados a mais,
 *    descartados localmente.
 *
 * Consequência deliberada de `range=date_approved`: pagamento que nunca foi
 * aprovado (recusado, pendente) não aparece. É o que se quer — o que falta no
 * livro-caixa é receita, e importar tentativa recusada como se fosse
 * pagamento seria pior que não vê-la.
 *
 * A busca do MP cobre os últimos 12 meses; competência mais antiga que isso
 * volta vazia, e o diff dirá (corretamente) que não há nada a importar.
 */
async function buscarNoMp(fromISO: string, toISO: string): Promise<MpSearchResult[]> {
  const client = new Payment(getMpClient());
  const beginDate = new Date(Date.parse(fromISO) - MP_FOLGA_MS).toISOString();
  const endDate = new Date(Date.parse(toISO) + MP_FOLGA_MS).toISOString();

  const todos: MpSearchResult[] = [];
  for (let pagina = 0; pagina < MP_MAX_PAGES; pagina++) {
    let resposta;
    try {
      resposta = await client.search({
        options: {
          sort: "date_approved",
          criteria: "asc",
          range: "date_approved",
          begin_date: beginDate,
          end_date: endDate,
          limit: MP_PAGE_SIZE,
          offset: pagina * MP_PAGE_SIZE,
        },
      });
    } catch (err) {
      console.error("[reconciliar] falha ao buscar pagamentos no MP:", err);
      throw new ApiError(
        "Não consegui consultar o Mercado Pago agora. Tente de novo em alguns minutos.",
        502,
      );
    }
    const resultados = (resposta.results ?? []) as MpSearchResult[];
    todos.push(...resultados);
    if (resultados.length < MP_PAGE_SIZE) return todos;
  }

  throw new ApiError(
    `O Mercado Pago devolveu mais de ${MP_MAX_PAGES * MP_PAGE_SIZE} pagamentos neste período. ` +
      "A reconciliação parou para não mostrar uma diferença pela metade.",
    502,
  );
}

/**
 * Traduz o que veio do MP para candidatos gravaveis — e separa o que não dá
 * para gravar em `ignorados`, com o motivo.
 *
 * Nada é inventado no caminho: pagamento sem `external_reference` de tenant
 * válido, ou cujo tenant não existe mais, NÃO vira linha com nome improvisado
 * de pagador. `payments` é registro fiscal; um `tenant_name` chutado é pior
 * que uma linha ausente que aparece na tela pedindo decisão humana. É a mesma
 * escolha que o webhook faz (lá ele loga e sai) — a diferença é que aqui o
 * fato chega até o operador em vez de morrer num log.
 */
async function resolverCandidatos(
  brutos: readonly MpSearchResult[], fromISO: string, toISO: string,
): Promise<{ candidatos: CandidatoMp[]; ignorados: ItemIgnorado[] }> {
  const candidatos: CandidatoMp[] = [];
  const ignorados: ItemIgnorado[] = [];
  // Um mês costuma ter várias cobranças do mesmo tenant — resolve uma vez.
  const cacheTenant = new Map<number, Awaited<ReturnType<typeof getTenantById>>>();

  for (const bruto of brutos) {
    const mpPaymentId = String(bruto.id ?? "");
    const grossCents = grossCentsOf(bruto);
    if (!mpPaymentId) {
      // Nada que veio do MP some sem o operador ver — nem isto, que só pode
      // acontecer se o recurso vier corrompido. Antes era um `continue` mudo,
      // a única exceção à regra do módulo.
      ignorados.push({
        mpPaymentId: "(sem id)", grossCents,
        motivo: "o Mercado Pago devolveu um pagamento sem id — não dá para identificar nem gravar",
      });
      continue;
    }

    const paidAt = derivePaidAt(bruto);
    if (!paidAt) {
      ignorados.push({ mpPaymentId, grossCents, motivo: "pagamento sem data no Mercado Pago" });
      continue;
    }
    // Recorte SEMIABERTO pelo relógio de parede, igual ao `lt` de
    // `listPaymentsByPeriod`. A janela pedida ao MP é mais larga de propósito;
    // ESTE filtro é a definição da competência (ver lib/reconciliacao.ts).
    if (!dentroDaCompetencia(paidAt, fromISO, toISO)) continue;

    const tenantId = bruto.external_reference ? Number(bruto.external_reference) : NaN;
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      ignorados.push({
        mpPaymentId, grossCents,
        motivo: "sem referência de loja (external_reference) — não é cobrança de assinatura",
      });
      continue;
    }

    if (!cacheTenant.has(tenantId)) {
      cacheTenant.set(tenantId, await getTenantById(tenantId));
    }
    const tenant = cacheTenant.get(tenantId) ?? null;
    if (!tenant) {
      ignorados.push({
        mpPaymentId, grossCents,
        motivo: `loja #${tenantId} não existe mais — importe pelo banco se a nota for necessária`,
      });
      continue;
    }

    candidatos.push({
      mpPaymentId,
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantDocument: tenant.document,
      plan: tenant.plan,
      mpPreapprovalId: tenant.mp_subscription_id,
      couponId: tenant.coupon_id,
      paidAt,
      grossCents,
      status: String(bruto.status ?? ""),
    });
  }

  return { candidatos, ignorados };
}

/**
 * `Promise.all` sobre um lote de N itens dispararia N chamadas ao MP de uma
 * vez e viraria 429 — e um 429 aqui custa um item pulado. Roda em janelas de
 * `limite`, preservando a ordem do resultado.
 */
async function mapComLimite<T, R>(
  itens: readonly T[], limite: number, fn: (item: T, indice: number) => Promise<R>,
): Promise<R[]> {
  const saida: R[] = new Array(itens.length);
  let proximo = 0;
  const trabalhadores = Array.from({ length: Math.min(limite, itens.length) }, async () => {
    while (proximo < itens.length) {
      const i = proximo++;
      saida[i] = await fn(itens[i], i);
    }
  });
  await Promise.all(trabalhadores);
  return saida;
}

type ResultadoItem =
  | { tipo: "importado" }
  | { tipo: "atualizado" }
  | { tipo: "pulado" }
  | { tipo: "falha"; falha: ItemFalha };

function motivoDe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Grava um FALTANTE. Relê o recurso completo no MP antes: o resumo do
 * `/search` não traz `fee_details`, então gravar direto a partir dele marcaria
 * toda linha importada como `incomplete` com `net = gross` — o líquido do
 * console ficaria inflado justamente nos meses em que o webhook falhou.
 * `computeFeeAndNet` é a MESMA função do webhook (lib/mp-payment.ts): a linha
 * que entra por aqui e a que entra por lá têm a mesma taxa.
 */
async function gravarFaltante(
  client: Payment, faltante: CandidatoMp,
): Promise<ResultadoItem> {
  // `listPaymentsByPeriod` só enxerga ESTA competência. Um pagamento cuja data
  // no MP e no banco caem em meses diferentes existe e é UNIQUE — reler por id
  // evita tentar criar o que já está lá.
  if (await getPaymentByMpId(faltante.mpPaymentId)) return { tipo: "pulado" };

  const completo = await client.get({ id: faltante.mpPaymentId });
  const { feeCents, netCents, incomplete } = computeFeeAndNet(completo, faltante.grossCents);
  const { created } = await recordPayment({
    tenant_id: faltante.tenantId,
    tenant_name: faltante.tenantName,
    tenant_document: faltante.tenantDocument,
    plan: faltante.plan,
    mp_payment_id: faltante.mpPaymentId,
    mp_preapproval_id: faltante.mpPreapprovalId,
    gross_cents: faltante.grossCents,
    fee_cents: feeCents,
    net_cents: netCents,
    status: faltante.status,
    paid_at: faltante.paidAt,
    coupon_id: faltante.couponId,
    incomplete,
  });
  // `recordPayment` usa `onConflictDoNothing`: `created: false` é uma corrida
  // com o webhook (a linha nasceu entre o SELECT e o INSERT). Contar só o que
  // foi criado de fato mantém o número da tela honesto.
  return created ? { tipo: "importado" } : { tipo: "pulado" };
}

/**
 * Corrige um DIVERGENTE. O patch é o MESMO do webhook (route.ts do webhook,
 * o trecho de reentrega), e não só `{ status }`.
 *
 * O motivo é concreto: o cenário canônico de webhook perdido é a linha ter
 * ficado `pending` sem taxa. Trocar só o status a deixaria `approved` com
 * `fee_cents` nulo, `net = gross` e `incomplete: true` — exatamente a inflação
 * de líquido que o segundo `GET` dos faltantes existe para evitar, e que
 * ninguém veria, porque `incomplete` não aparece em tela nenhuma.
 *
 * O bruto usado no cálculo é o JÁ GRAVADO, não o que o MP mostra agora: bruto
 * é snapshot do momento do pagamento (ver `UpdatePaymentInput` em
 * lib/db/payments.ts), e o líquido tem que fechar com ele.
 */
async function corrigirDivergente(
  client: Payment, mpPaymentId: string, statusNovo: string, paidAt: string,
): Promise<ResultadoItem> {
  // Relê o estado atual: entre a conferência e a confirmação o webhook pode
  // ter entregue o estorno, ou a linha pode ter sumido.
  const atual = await getPaymentByMpId(mpPaymentId);
  if (!atual) return { tipo: "pulado" };
  if (!shouldOverwriteStatus(atual.status, statusNovo)) return { tipo: "pulado" };

  const completo = await client.get({ id: mpPaymentId });
  const { feeCents, netCents, incomplete } = computeFeeAndNet(completo, atual.gross_cents);

  const patch: UpdatePaymentInput = { status: statusNovo };
  if (!incomplete) {
    patch.fee_cents = feeCents;
    patch.net_cents = netCents;
    patch.incomplete = false;
  } else if (atual.incomplete) {
    // Nem esta leitura nem a gravada têm taxa — sem regressão possível, só
    // mantém `net = gross`.
    patch.net_cents = atual.gross_cents;
  }
  // `date_approved` pode ter faltado quando a linha nasceu `pending`; a
  // leitura atual traz o valor definitivo. Mesmo comportamento do webhook.
  patch.paid_at = paidAt;

  await updatePayment(mpPaymentId, patch);
  return { tipo: "atualizado" };
}

interface ResultadoImportacao {
  importados: number;
  atualizados: number;
  falhas: ItemFalha[];
  naoProcessados: number;
}

/**
 * Grava o que o diff apontou, em lote — com teto, concorrência limitada e
 * falha POR ITEM.
 *
 * A falha por item é o ponto: antes, um erro em qualquer id abortava tudo dali
 * para frente. Como a busca vem ordenada por `date_approved asc`, um id
 * envenenado (429, recurso inacessível) bloqueava PERMANENTEMENTE todos os
 * posteriores — rodar de novo esbarrava no mesmo id, na mesma posição. Agora o
 * item vira `falhas[]` e o lote segue; silenciar o que não entrou seria pior
 * que não importar.
 */
async function importar(diff: Diferenca): Promise<ResultadoImportacao> {
  const client = new Payment(getMpClient());

  const tarefas: Array<() => Promise<ResultadoItem>> = [
    ...diff.faltantes.map((f) => () => gravarFaltante(client, f)),
    ...diff.divergentes.map(
      (d) => () => corrigirDivergente(client, d.mpPaymentId, d.status, d.paidAt),
    ),
  ];
  const ids = [
    ...diff.faltantes.map((f) => f.mpPaymentId),
    ...diff.divergentes.map((d) => d.mpPaymentId),
  ];

  const daRodada = tarefas.slice(0, MAX_ITENS_POR_RODADA);
  const naoProcessados = tarefas.length - daRodada.length;

  const resultados = await mapComLimite(daRodada, CONCORRENCIA_MP, async (tarefa, i) => {
    try {
      return await tarefa();
    } catch (err) {
      console.error("[reconciliar] item falhou, lote segue:", ids[i], err);
      return { tipo: "falha", falha: { mpPaymentId: ids[i], motivo: motivoDe(err) } } as const;
    }
  });

  return {
    importados: resultados.filter((r) => r.tipo === "importado").length,
    atualizados: resultados.filter((r) => r.tipo === "atualizado").length,
    falhas: resultados.flatMap((r) => (r.tipo === "falha" ? [r.falha] : [])),
    naoProcessados,
  };
}

/**
 * Token do conjunto conferido. `sha256` do texto canônico do diff — só para
 * ser curto e opaco na querystring do cliente; a garantia é a igualdade do
 * texto, não a criptografia.
 */
function tokenDe(competencia: string, diff: Diferenca): string {
  return createHash("sha256").update(assinaturaDiferenca(competencia, diff)).digest("hex").slice(0, 32);
}

export const POST = withFinanceAccess(async (req) => {
  const { competencia, token } = await parseBody(req, reconciliarInputSchema);
  const dry = isDryRun(req);

  // Falta o token antes de qualquer I/O: importar sem ter conferido é erro do
  // chamador, e não custa uma consulta ao MP para descobrir isso.
  if (!dry && !token) {
    throw new ApiError("Confira o período antes de importar.", 400);
  }

  const { from, to } = periodBounds(competencia);
  const brutos = await buscarNoMp(from, to);
  const { candidatos, ignorados } = await resolverCandidatos(brutos, from, to);
  const locais = await listPaymentsByPeriod(competencia);
  const diff = classificarDiferenca(candidatos, locais);
  const tokenAtual = tokenDe(competencia, diff);

  // O operador confirmou um CONJUNTO, não um número. Se o que está no MP mudou
  // entre as duas etapas, gravar seria escrever uma decisão que ele não tomou —
  // e para `divergentes` isso significa mexer no status de um pagamento que ele
  // nunca viu na tela.
  if (!dry && token !== tokenAtual) {
    throw new ApiError(
      "O que está no Mercado Pago mudou desde a conferência. Confira de novo antes de importar.",
      409,
    );
  }

  const gravado: ResultadoImportacao = dry
    ? { importados: 0, atualizados: 0, falhas: [], naoProcessados: 0 }
    : await importar(diff);

  const resultado: ReconciliacaoResultado = {
    competencia,
    dry,
    // Total DA COMPETÊNCIA, não da janela consultada (que é mais larga de
    // propósito): assim `encontrados = faltantes + divergentes +
    // jaRegistrados + ignorados` fecha na tela.
    encontradosMp: candidatos.length + ignorados.length,
    ignorados,
    token: tokenAtual,
    ...diff,
    ...gravado,
  };
  return NextResponse.json(resultado);
});
