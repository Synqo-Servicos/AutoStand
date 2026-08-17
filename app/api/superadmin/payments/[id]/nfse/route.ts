import { NextResponse } from "next/server";
import { ApiError, parseBody, withSuperAdmin } from "@/lib/api";
import { withFinanceAccess } from "@/lib/finance-access";
import { clearNfse, getPaymentById, registerNfse } from "@/lib/db";
import { nfseInputSchema } from "@/lib/validation";

/**
 * Esta rota mora em `app/api/**`, que não passa por layout nenhum — nem
 * pelo fence de host, nem pelo gate de auth de `(financeiro)`. Toda a
 * proteção está nos wrappers abaixo, e os dois são deliberadamente
 * diferentes:
 *
 * - `POST` (registrar) → `withFinanceAccess`: super_admin **e** contador.
 *   É a única gravação que o papel `contador` faz no sistema.
 * - `DELETE` (desfazer) → `withSuperAdmin`: só super_admin.
 *
 * A assimetria é o desenho, não um esquecimento. `contador` é a credencial
 * mais fraca com acesso ao console; dar a ela o poder de apagar o rastro de
 * uma emissão seria dar, junto com o poder de errar, o poder de esconder o
 * erro.
 */

/** Mesma validação nos dois verbos — id vem da URL, nunca do corpo. */
function parsePaymentId(raw: string): number {
  const paymentId = Number(raw);
  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    throw new ApiError("id inválido", 400);
  }
  return paymentId;
}

/**
 * Traduz "o UPDATE não afetou nenhuma linha" na causa real.
 *
 * `registerNfse` e `clearNfse` devolvem `null` para causas distintas — id
 * inexistente, estado errado da linha — porque uma única query com
 * `RETURNING` não as separa. A query continua sendo a guarda (é ela que é
 * atômica); esta leitura extra só existe para a mensagem, e só roda no
 * caminho de erro. Se a linha mudar entre o UPDATE e esta leitura, o que
 * fica impreciso é o texto do erro, nunca o que foi gravado.
 */
async function explicarFalha(paymentId: number, esperado: "registrar" | "desfazer"): Promise<never> {
  const atual = await getPaymentById(paymentId);
  if (!atual) throw new ApiError("Pagamento não encontrado.", 404);

  if (esperado === "desfazer") {
    throw new ApiError("Este pagamento não tem NFS-e registrada.", 409);
  }

  // Ordem importa: "já tem nota" é a causa mais acionável e vem primeiro,
  // mesmo numa linha que também esteja com status inelegível (estorno
  // registrado depois da nota emitida, por exemplo).
  if (atual.nfse_issued_at) {
    throw new ApiError("Este pagamento já tem NFS-e registrada.", 409);
  }
  // 422 e não 409: o pedido é válido e o recurso existe, mas o estado dele
  // não admite a operação — e o contador precisa ver QUAL status barrou,
  // senão a única leitura possível é "o sistema está quebrado".
  throw new ApiError(
    `Pagamento com status "${atual.status}" não gera NFS-e. Só pagamento aprovado entra na fila fiscal.`,
    422,
  );
}

/**
 * Registra o número da NFS-e emitida à mão no portal.
 *
 * O que impede o carimbo em massa (varrer ids 1..N com POST) é o WHERE de
 * `registerNfse`, que exige status elegível — o mesmo predicado que monta a
 * fila em `listPendingNfse`. Aqui só se garante que o bloqueio vire erro
 * explícito, nunca 200 mudo.
 */
export const POST = withFinanceAccess<{ id: string }>(async (req, { params, userId }) => {
  const paymentId = parsePaymentId(params.id);
  const { numero } = await parseBody(req, nfseInputSchema);

  // `nfse_issued_by` é sempre o userId da sessão — o corpo nunca é fonte de
  // papel nem de autoria.
  const payment = await registerNfse(paymentId, numero, userId);
  // `return explicarFalha(...)` e não `if (!payment) await explicarFalha(...)`:
  // o tipo `Promise<never>` só fecha o caminho de sucesso se a chamada estiver
  // na posição de return. Da outra forma o compilador aceitaria, calado, um
  // `json(null)` com status 200 caso alguém um dia fizesse a função deixar de
  // lançar — que é exatamente o "sucesso silencioso" que esta rota não pode ter.
  if (!payment) return explicarFalha(paymentId, "registrar");

  return NextResponse.json(payment);
});

/**
 * Desfaz o registro: limpa `nfse_issued_at`/`nfse_number`/`nfse_issued_by`
 * e devolve o pagamento para a fila fiscal.
 *
 * Existe porque, sem ele, um número digitado errado era permanente —
 * `registerNfse` era a única escrita em `nfse_*` no sistema, e a correção
 * exigia acesso direto ao banco de produção. Isto NÃO cancela a nota na
 * prefeitura: só desfaz o vínculo aqui, para que a emissão certa possa ser
 * registrada em seguida.
 */
export const DELETE = withSuperAdmin<{ id: string }>(async (_req, { params }) => {
  const paymentId = parsePaymentId(params.id);

  const payment = await clearNfse(paymentId);
  if (!payment) return explicarFalha(paymentId, "desfazer");

  return NextResponse.json(payment);
});
