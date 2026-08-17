/**
 * Tradução do payload do Mercado Pago para os números que gravamos em
 * `payments` — bruto, taxa, líquido, data efetiva — e a regra de qual status
 * pode sobrescrever qual.
 *
 * Módulo PURO de propósito: sem banco, sem `auth`, sem o SDK do Mercado Pago.
 * Recebe objetos com a FORMA do recurso do MP, não o tipo do SDK, para servir
 * tanto ao `GET /v1/payments/:id` (recurso completo) quanto ao
 * `GET /v1/payments/search` (recurso resumido, que não traz `fee_details`).
 *
 * Existe por dois motivos concretos:
 *
 * 1. DOIS caminhos gravam a mesma linha — o webhook
 *    (`app/api/webhooks/mercadopago/route.ts`) e a reconciliação
 *    (`app/api/superadmin/payments/reconciliar/route.ts`). Taxa calculada de
 *    dois jeitos diferentes é divergência fiscal silenciosa: a linha que
 *    entrou pelo webhook e a que entrou pela reconciliação teriam líquidos
 *    diferentes para o mesmo pagamento, e ninguém perceberia.
 * 2. Um `route.ts` do App Router só pode exportar handlers HTTP e as configs
 *    de rota. Não dá para a reconciliação importar a função de dentro do
 *    webhook — extrair era a única forma de compartilhar sem duplicar.
 */

/**
 * O mínimo do recurso do MP para derivar taxa e líquido. Estrutural, não o
 * tipo do SDK: `PaymentResponse` (do `get`) e `PaymentSearchResult` (do
 * `search`) são tipos diferentes e os dois satisfazem esta forma.
 */
export interface MpFeeSource {
  transaction_details?: { net_received_amount?: number };
  fee_details?: Array<{ amount?: number; fee_payer?: string }>;
}

/**
 * Faixa em que o líquido que o MP declara é PLAUSÍVEL, e portanto digno de
 * virar taxa gravada: `0 < net <= gross`.
 *
 * Por que a faixa existe, e não só `typeof net === "number"`: zero é um valor
 * que o campo assume de verdade — o recurso traz `net_received_amount: 0`
 * enquanto o líquido não foi liquidado (pagamento ainda não creditado). Com o
 * teste de tipo puro, um `approved` de R$ 249,90 com net 0 gravava
 * `fee_cents: 24990`, `net_cents: 0` e `incomplete: false`: taxa de 100% do
 * bruto, marcada como dado completo, direto no número que o contador copia
 * para dentro da nota. O invariante `bruto − taxa = líquido` fecha nesse caso
 * (24990 − 24990 = 0), então ele não serve de rede aqui.
 *
 * Os outros dois lados da faixa são igualmente impossíveis: net negativo
 * produziria líquido negativo, e net acima do bruto produziria taxa NEGATIVA
 * (o MP nos pagando mais do que o cliente pagou). Nos três casos a resposta é
 * a mesma e é a promessa desta função: não inventar taxa.
 *
 * `net === gross` fica DENTRO da faixa de propósito — taxa zero é legítima
 * (cortesia, promoção) e recusá-la marcaria como duvidoso um dado bom.
 */
function netEhPlausivel(netCents: number, grossCents: number): boolean {
  return netCents > 0 && netCents <= grossCents;
}

/**
 * Bruto → líquido. Prioridade: `transaction_details.net_received_amount`
 * — o líquido autoritativo que o próprio MP calcula, derivando a taxa por
 * `gross - net` — mas só quando ele é plausível (ver `netEhPlausivel`). Sem
 * ele, soma `fee_details[]` filtrando por `fee_payer !== "payer"` (taxa
 * atribuída ao PAGADOR não é despesa nossa; ausência de `fee_payer` é tratada
 * como `collector`, o caso comum — ver
 * `node_modules/mercadopago/dist/clients/payment/commonTypes.d.ts`). Sem
 * nenhum dos dois: nunca inventar a taxa — `net = gross`,
 * `incomplete = true`.
 *
 * Um net implausível NÃO encerra a decisão: cai para `fee_details`, que pode
 * ter a taxa de verdade. Só depois de os dois falharem é que a linha é
 * marcada como incompleta.
 */
export function computeFeeAndNet(
  payment: MpFeeSource, grossCents: number,
): { feeCents: number | null; netCents: number; incomplete: boolean } {
  const netReceived = payment.transaction_details?.net_received_amount;
  if (typeof netReceived === "number") {
    const netCents = Math.round(netReceived * 100);
    if (netEhPlausivel(netCents, grossCents)) {
      return { feeCents: grossCents - netCents, netCents, incomplete: false };
    }
  }
  const collectorFees = (payment.fee_details ?? []).filter((f) => f.fee_payer !== "payer");
  if (collectorFees.length === 0) {
    return { feeCents: null, netCents: grossCents, incomplete: true };
  }
  const feeCents = Math.round(collectorFees.reduce((sum, f) => sum + (f.amount ?? 0), 0) * 100);
  return { feeCents, netCents: grossCents - feeCents, incomplete: false };
}

/**
 * Status "terminais negativos": uma reentrega fora de ordem não pode
 * regredir a linha PRA FORA deles. Cenário real: o `approved` original
 * fica pendente de reenvio (ex.: o banco ficou fora e o POST devolveu
 * 500), o estorno chega e grava `refunded` primeiro, e o retry do
 * `approved` chega DEPOIS — sem essa guarda, o retry sobrescreveria
 * `refunded` de volta pra `approved` e a receita ficaria contada pra
 * sempre sobre um pagamento já devolvido.
 *
 * A reconciliação tem o MESMO risco por um caminho diferente: ela lê o
 * estado do MP num instante qualquer e pode encontrar um `approved` que já
 * foi estornado depois — por isso ela também passa por aqui.
 *
 * DUAS GRAFIAS DE CHARGEBACK, de propósito:
 *
 * - `charged_back` (com underscore) é a grafia REAL do Mercado Pago — a lista
 *   de status da API é `pending | approved | authorized | in_process |
 *   in_mediation | rejected | cancelled | refunded | charged_back`
 *   (doc "Get payment status / Collection creation results"). É a que chega
 *   numa notificação e a que a busca devolve.
 * - `chargeback` (sem underscore) nunca vem do MP. Está aqui porque é a grafia
 *   do comentário da coluna `status` em `lib/schema.ts` e do plano — ou seja,
 *   é o que uma linha corrigida à mão no banco pode ter.
 *
 * O conjunto precisa cobrir as duas porque ele é lido contra o status GRAVADO
 * (que pode ter qualquer uma) e contra o status que chega (que tem a do MP).
 * Deixar `charged_back` de fora significaria: `approved` relido pela
 * reconciliação sobrescreve um estorno bancário, e a receita volta a contar
 * sobre dinheiro que o banco já tirou de volta.
 */
export const TERMINAL_NEGATIVE_STATUSES: ReadonlySet<string> = new Set([
  "refunded",
  "charged_back",
  "chargeback",
]);

export function shouldOverwriteStatus(currentStatus: string, incomingStatus: string): boolean {
  return !(TERMINAL_NEGATIVE_STATUSES.has(currentStatus) && !TERMINAL_NEGATIVE_STATUSES.has(incomingStatus));
}

/** Reais → centavos, sempre arredondando (nunca truncando). */
export function grossCentsOf(payment: { transaction_amount?: number }): number {
  return Math.round((payment.transaction_amount ?? 0) * 100);
}

/**
 * Data efetiva do pagamento: `date_approved`, ou `date_created` enquanto ele
 * não foi aprovado.
 *
 * Devolve `null` — e NÃO "agora" — quando o recurso não traz nenhuma das
 * duas. O fallback é decisão de quem chama, porque os dois chamadores
 * precisam de coisas opostas: o webhook prefere gravar a linha com um
 * carimbo aproximado a perder a notificação; a reconciliação usa esta data
 * para decidir a COMPETÊNCIA do pagamento, e "agora" jogaria um pagamento de
 * julho dentro de agosto, em silêncio.
 */
export function derivePaidAt(
  payment: { date_approved?: string; date_created?: string },
): string | null {
  return payment.date_approved ?? payment.date_created ?? null;
}
