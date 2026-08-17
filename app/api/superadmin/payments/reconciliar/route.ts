import { NextResponse, type NextRequest } from "next/server";
import MercadoPagoConfig, { Payment } from "mercadopago";
import { ApiError, parseBody } from "@/lib/api";
import { withFinanceAccess } from "@/lib/finance-access";
import {
  getPaymentByMpId, getTenantById, listPaymentsByPeriod, periodBounds,
  recordPayment, updatePayment,
} from "@/lib/db";
import { computeFeeAndNet, derivePaidAt, grossCentsOf } from "@/lib/mp-payment";
import {
  classificarDiferenca, dentroDaCompetencia,
  type CandidatoMp, type ItemIgnorado, type ReconciliacaoResultado,
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
 *  - `begin_date`/`end_date` — ISO-8601. `begin_date` é o `from` de
 *    `periodBounds`; `end_date` é o `to` MENOS 1 ms, porque o `to` de
 *    `periodBounds` é o intervalo SEMIABERTO (primeiro instante do mês
 *    seguinte) e o `end_date` do MP é inclusivo. Mesmo raciocínio do
 *    `mesBoundsInclusivos` de lib/finance-config.ts, aqui derivado do próprio
 *    `periodBounds` para não existir uma segunda definição de "agosto".
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
  const beginDate = fromISO;
  const endDate = new Date(Date.parse(toISO) - 1).toISOString();

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
    if (!mpPaymentId) continue;

    const paidAt = derivePaidAt(bruto);
    if (!paidAt) {
      ignorados.push({ mpPaymentId, grossCents, motivo: "pagamento sem data no Mercado Pago" });
      continue;
    }
    // Recorte SEMIABERTO, igual ao `lt` de `listPaymentsByPeriod`: o `end_date`
    // do MP é uma aproximação da janela, este filtro é a definição dela.
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
 * Grava o que o diff apontou.
 *
 * Cada faltante é RELIDO no MP (`GET /v1/payments/:id`) antes de virar linha:
 * o resumo do `/search` não traz `fee_details`, então gravar direto a partir
 * dele marcaria toda linha importada como `incomplete` com `net = gross` — o
 * líquido do console ficaria inflado justamente nos meses em que o webhook
 * falhou. `computeFeeAndNet` é a MESMA função do webhook (lib/mp-payment.ts):
 * a linha que entra por aqui e a que entra por lá têm a mesma taxa.
 */
async function importar(
  diff: ReturnType<typeof classificarDiferenca>,
): Promise<{ importados: number; atualizados: number }> {
  const client = new Payment(getMpClient());
  let importados = 0;

  for (const faltante of diff.faltantes) {
    // `listPaymentsByPeriod` só enxerga ESTA competência. Um pagamento cuja
    // data no MP e no banco caem em meses diferentes existe e é UNIQUE —
    // reler por id evita tentar criar o que já está lá.
    if (await getPaymentByMpId(faltante.mpPaymentId)) continue;

    let completo;
    try {
      completo = await client.get({ id: faltante.mpPaymentId });
    } catch (err) {
      console.error("[reconciliar] falha ao reler pagamento no MP:", faltante.mpPaymentId, err);
      throw new ApiError(
        "Não consegui reler os detalhes do pagamento no Mercado Pago. Nada foi importado além do que já apareceu.",
        502,
      );
    }

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
    if (created) importados += 1;
  }

  let atualizados = 0;
  for (const divergente of diff.divergentes) {
    // Só o status: os outros campos são snapshot do momento do pagamento e
    // não devem ser reescritos por uma leitura posterior (ver
    // `UpdatePaymentInput` em lib/db/payments.ts). A guarda de regressão de
    // status já foi aplicada em `classificarDiferenca`.
    await updatePayment(divergente.mpPaymentId, { status: divergente.status });
    atualizados += 1;
  }

  return { importados, atualizados };
}

export const POST = withFinanceAccess(async (req) => {
  const { competencia } = await parseBody(req, reconciliarInputSchema);
  const dry = isDryRun(req);

  const { from, to } = periodBounds(competencia);
  const brutos = await buscarNoMp(from, to);
  const { candidatos, ignorados } = await resolverCandidatos(brutos, from, to);
  const locais = await listPaymentsByPeriod(competencia);
  const diff = classificarDiferenca(candidatos, locais);

  const gravado = dry ? { importados: 0, atualizados: 0 } : await importar(diff);

  const resultado: ReconciliacaoResultado = {
    competencia,
    dry,
    consultadosMp: brutos.length,
    ignorados,
    ...diff,
    ...gravado,
  };
  return NextResponse.json(resultado);
});
