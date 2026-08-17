import { describe, it, expect, vi, beforeEach } from "vitest";
import { periodoDaCompetencia } from "@/lib/competencia";

/**
 * `vi.hoisted` e não `const fn = vi.fn()` no topo: a fábrica do `vi.mock` é
 * içada para antes das declarações do módulo, e um `const` lido de dentro
 * dela cai em TDZ — no vitest 4.1.5 isso trava a suíte em silêncio por dois
 * minutos em vez de dar erro. Já aconteceu três vezes nesta branch.
 */
const mocks = vi.hoisted(() => ({
  listPaymentsByPeriod: vi.fn(),
  getPaymentByMpId: vi.fn(),
  recordPayment: vi.fn(),
  updatePayment: vi.fn(),
  getTenantById: vi.fn(),
  periodBounds: vi.fn(),
  paymentSearch: vi.fn(),
  paymentGet: vi.fn(),
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  listPaymentsByPeriod: mocks.listPaymentsByPeriod,
  getPaymentByMpId: mocks.getPaymentByMpId,
  recordPayment: mocks.recordPayment,
  updatePayment: mocks.updatePayment,
  getTenantById: mocks.getTenantById,
  periodBounds: mocks.periodBounds,
}));

// Mesmo motivo do tests/api/payments-nfse.test.ts: `@/lib/finance-access`
// importa `@/lib/auth` (que puxa next-auth → "next/server" sem extensão, que
// o resolvedor ESM do vitest não resolve). Usamos o wrapper REAL — é ele que
// converte ApiError/ZodError em resposta HTTP e nega o papel errado — e só
// fixamos a sessão mockando `auth`.
vi.mock("@/lib/auth", () => ({ auth: mocks.auth, getApiTenantId: vi.fn() }));

vi.mock("mercadopago", () => ({
  default: class {
    constructor() {}
  },
  MercadoPagoConfig: class {
    constructor() {}
  },
  Payment: class {
    search = mocks.paymentSearch;
    get = mocks.paymentGet;
  },
  PreApproval: class {},
}));

/**
 * A janela que a rota receberia de `periodBounds` — vinda da implementação
 * REAL, não copiada à mão. Copiada, ela vira uma segunda definição de
 * competência dentro do teste: foi assim que este arquivo passou a afirmar
 * limites de UTC (`00:00Z`) enquanto o produto recortava outro mês.
 *
 * Agosto/2026 em São Paulo = `2026-08-01T03:00:00.000Z` → `2026-09-01T03:00:00.000Z`.
 */
const AGOSTO = periodoDaCompetencia("2026-08");

const TENANT = {
  id: 7,
  name: "Auto Brasil",
  document: "12345678000199",
  plan: "pro",
  coupon_id: null,
  mp_subscription_id: "preap-7",
};

function sessionAs(role: string, id = 1) {
  mocks.auth.mockResolvedValue({ user: { id, role } });
}

/**
 * `dry` ausente = importa (contrato do brief). Passar `dry: "true"` liga a
 * simulação.
 */
function post(body: unknown, dry?: string) {
  const base = "http://console.localhost:3000/api/superadmin/payments/reconciliar";
  return {
    url: dry === undefined ? base : `${base}?dry=${dry}`,
    json: async () => body,
  } as never;
}

const ctx = () => ({ params: Promise.resolve({}) }) as never;

/**
 * O fluxo real: confere (`dry`), pega o token do conjunto mostrado, e só
 * então importa. A rota recusa importação sem o token do que foi conferido —
 * ver o bloco "confirmação amarrada ao conjunto conferido".
 */
async function conferirEImportar(
  POST: (req: never, ctx: never) => Promise<Response>,
  competencia = "2026-08",
) {
  const conferencia = await POST(post({ competencia }, "true"), ctx());
  const { token } = await conferencia.json();
  return POST(post({ competencia, token }), ctx());
}

/** Resultado resumido do `GET /v1/payments/search`. */
function mpResult(over: Record<string, unknown> = {}) {
  return {
    id: "999",
    status: "approved",
    transaction_amount: 249.9,
    date_approved: "2026-08-15T12:00:00.000-03:00",
    external_reference: "7",
    ...over,
  };
}

/** Recurso completo do `GET /v1/payments/:id` — este traz `fee_details`. */
function mpFull(over: Record<string, unknown> = {}) {
  return { ...mpResult(), fee_details: [{ amount: 12.0, fee_payer: "collector" }], ...over };
}

/** Uma única página de busca, já no formato do envelope do MP. */
function umaPagina(results: unknown[]) {
  mocks.paymentSearch.mockResolvedValue({ results, paging: { total: results.length, limit: 50, offset: 0 } });
}

/** Busca paginada de verdade — para os casos com mais resultados que uma página. */
function paginado(results: unknown[]) {
  mocks.paymentSearch.mockImplementation(
    async ({ options }: { options: { limit: number; offset: number } }) => ({
      results: results.slice(options.offset, options.offset + options.limit),
      paging: { total: results.length, limit: options.limit, offset: options.offset },
    }),
  );
}

async function route() {
  return (await import("@/app/api/superadmin/payments/reconciliar/route")).POST;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST-token";
  sessionAs("super_admin", 1);
  mocks.periodBounds.mockReturnValue(AGOSTO);
  mocks.listPaymentsByPeriod.mockResolvedValue([]);
  mocks.getTenantById.mockResolvedValue(TENANT);
  mocks.getPaymentByMpId.mockResolvedValue(null);
  mocks.recordPayment.mockResolvedValue({ created: true });
  mocks.updatePayment.mockResolvedValue({ id: 1 });
  mocks.paymentGet.mockResolvedValue(mpFull());
  umaPagina([]);
});

// ---------------------------------------------------------------------------
// Acesso
// ---------------------------------------------------------------------------

describe("POST /api/superadmin/payments/reconciliar — acesso", () => {
  it("tenant_admin recebe 401 e o Mercado Pago nem é consultado", async () => {
    sessionAs("tenant_admin", 3);
    const POST = await route();

    const res = await POST(post({ competencia: "2026-08" }, "true"), ctx());

    expect(res.status).toBe(401);
    expect(mocks.paymentSearch).not.toHaveBeenCalled();
    expect(mocks.recordPayment).not.toHaveBeenCalled();
  });

  it("tenant_admin recebe 401 também na importação (sem ?dry)", async () => {
    sessionAs("tenant_admin", 3);
    const POST = await route();

    const res = await POST(post({ competencia: "2026-08" }), ctx());

    expect(res.status).toBe(401);
    expect(mocks.recordPayment).not.toHaveBeenCalled();
    expect(mocks.updatePayment).not.toHaveBeenCalled();
  });

  it("sem sessão recebe 401", async () => {
    mocks.auth.mockResolvedValue(null);
    const POST = await route();

    const res = await POST(post({ competencia: "2026-08" }, "true"), ctx());

    expect(res.status).toBe(401);
    expect(mocks.paymentSearch).not.toHaveBeenCalled();
  });

  it("super_admin passa", async () => {
    const POST = await route();
    const res = await POST(post({ competencia: "2026-08" }, "true"), ctx());
    expect(res.status).toBe(200);
  });

  it("contador passa — a rota é do financeiro (withFinanceAccess), não do super-admin", async () => {
    sessionAs("contador", 9);
    const POST = await route();
    const res = await POST(post({ competencia: "2026-08" }, "true"), ctx());
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Competência
// ---------------------------------------------------------------------------

describe("competência", () => {
  it("mês fora de 01–12 é rejeitado com 400 antes de consultar o MP", async () => {
    const POST = await route();

    const res = await POST(post({ competencia: "2026-13" }, "true"), ctx());

    expect(res.status).toBe(400);
    expect(mocks.paymentSearch).not.toHaveBeenCalled();
    expect(mocks.periodBounds).not.toHaveBeenCalled();
  });

  it("competência ausente é 400", async () => {
    const POST = await route();
    const res = await POST(post({}, "true"), ctx());
    expect(res.status).toBe(400);
    expect(mocks.paymentSearch).not.toHaveBeenCalled();
  });

  it("texto livre no lugar da competência é 400", async () => {
    const POST = await route();
    const res = await POST(post({ competencia: "agosto" }, "true"), ctx());
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Janela consultada no MP
// ---------------------------------------------------------------------------

describe("janela consultada no Mercado Pago", () => {
  it("consulta GET /v1/payments/search ordenado por date_approved, na janela da competência", async () => {
    const POST = await route();
    await POST(post({ competencia: "2026-08" }, "true"), ctx());

    expect(mocks.periodBounds).toHaveBeenCalledWith("2026-08");
    const { options } = mocks.paymentSearch.mock.calls[0][0];
    expect(options).toMatchObject({
      sort: "date_approved",
      criteria: "asc",
      range: "date_approved",
    });
    // A janela pedida ao MP é DELIBERADAMENTE mais larga que a competência —
    // um dia de folga de cada lado, contado a partir dos limites de São Paulo
    // (03:00Z), não de UTC. Depois que `paid_at` virou `timestamptz`, a folga
    // deixou de ser correção de fuso e passou a ser margem contra a semântica
    // de borda do MP (ver `MP_FOLGA_MS` na rota). Quem recorta de verdade é
    // `dentroDaCompetencia`, em cima do que voltou.
    expect(options.begin_date).toBe("2026-07-31T03:00:00.000Z");
    expect(options.end_date).toBe("2026-09-02T03:00:00.000Z");
  });

  it("pagina até acabar e junta os resultados", async () => {
    const pagina1 = Array.from({ length: 50 }, (_, i) => mpResult({ id: `p${i}` }));
    mocks.paymentSearch
      .mockResolvedValueOnce({ results: pagina1, paging: { total: 51, limit: 50, offset: 0 } })
      .mockResolvedValueOnce({ results: [mpResult({ id: "p50" })], paging: { total: 51, limit: 50, offset: 50 } });
    const POST = await route();

    const res = await POST(post({ competencia: "2026-08" }, "true"), ctx());
    const body = await res.json();

    expect(mocks.paymentSearch).toHaveBeenCalledTimes(2);
    expect(mocks.paymentSearch.mock.calls[1][0].options.offset).toBe(50);
    expect(body.encontradosMp).toBe(51);
  });

  it("MP fora do ar vira 502 e não grava nada", async () => {
    mocks.paymentSearch.mockRejectedValue(new Error("MP fora do ar"));
    const POST = await route();

    const res = await POST(post({ competencia: "2026-08", token: "qualquer" }), ctx());

    expect(res.status).toBe(502);
    expect(mocks.recordPayment).not.toHaveBeenCalled();
  });

  /**
   * Truncar em silêncio seria pior que falhar: o operador veria um diff
   * parcial e importaria "tudo o que falta" achando que fechou o mês.
   */
  it("período grande demais para paginar aborta em vez de importar pela metade", async () => {
    mocks.paymentSearch.mockResolvedValue({
      results: Array.from({ length: 50 }, (_, i) => mpResult({ id: `x${i}` })),
      paging: { total: 99999, limit: 50, offset: 0 },
    });
    const POST = await route();

    const res = await POST(post({ competencia: "2026-08", token: "qualquer" }), ctx());

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(mocks.recordPayment).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Dry-run: mostra a diferença, não grava
// ---------------------------------------------------------------------------

describe("?dry=true — mostra a diferença sem gravar", () => {
  it("não grava nada", async () => {
    umaPagina([mpResult({ id: "999" })]);
    const POST = await route();

    const res = await POST(post({ competencia: "2026-08" }, "true"), ctx());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.dry).toBe(true);
    expect(mocks.recordPayment).not.toHaveBeenCalled();
    expect(mocks.updatePayment).not.toHaveBeenCalled();
    expect(body.importados).toBe(0);
    expect(body.atualizados).toBe(0);
  });

  it("mostra quantos, de quais lojas e quanto em bruto", async () => {
    umaPagina([
      mpResult({ id: "999", transaction_amount: 249.9 }),
      mpResult({ id: "1000", transaction_amount: 99.0 }),
    ]);
    const POST = await route();

    const body = await (await POST(post({ competencia: "2026-08" }, "true"), ctx())).json();

    expect(body.faltantes).toHaveLength(2);
    expect(body.faltantes[0]).toMatchObject({
      mpPaymentId: "999",
      tenantName: "Auto Brasil",
      grossCents: 24990,
    });
    expect(body.totalFaltanteCents).toBe(34890);
  });

  it("pagamento que já existe localmente não aparece como diferença", async () => {
    umaPagina([mpResult({ id: "999" })]);
    mocks.listPaymentsByPeriod.mockResolvedValue([
      { id: 1, mp_payment_id: "999", status: "approved" },
    ]);
    const POST = await route();

    const body = await (await POST(post({ competencia: "2026-08" }, "true"), ctx())).json();

    expect(body.faltantes).toEqual([]);
    expect(body.divergentes).toEqual([]);
    expect(body.jaRegistrados).toBe(1);
    expect(body.totalFaltanteCents).toBe(0);
  });

  /**
   * O `dry` é a etapa de LEITURA. Se a lista local não fosse consultada, todo
   * pagamento do MP apareceria como faltando e o operador importaria em cima
   * do que já existe (o INSERT seria no-op, mas a tela teria mentido).
   */
  it("consulta o banco pela MESMA competência do corpo", async () => {
    const POST = await route();
    await POST(post({ competencia: "2026-08" }, "true"), ctx());
    expect(mocks.listPaymentsByPeriod).toHaveBeenCalledWith("2026-08");
  });

  it("qualquer valor de ?dry que não seja false/0 simula — errar de digitar não grava", async () => {
    umaPagina([mpResult({ id: "999" })]);
    const POST = await route();

    const body = await (await POST(post({ competencia: "2026-08" }, "sim"), ctx())).json();

    expect(body.dry).toBe(true);
    expect(mocks.recordPayment).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Recorte de período
// ---------------------------------------------------------------------------

describe("recorte de período", () => {
  it("pagamento fora da competência não entra na diferença, mesmo se o MP devolver", async () => {
    // Bordas expressas no fuso que DEFINE a competência. Antes estavam em `Z`,
    // o que só funcionava porque a janela também era de UTC — e `2026-09-01
    // T00:00:00Z` é 31/08 21:00 em São Paulo, ou seja, ainda agosto.
    umaPagina([
      mpResult({ id: "dentro", date_approved: "2026-08-31T23:59:59.000-03:00" }),
      mpResult({ id: "fora-depois", date_approved: "2026-09-01T00:00:00.000-03:00" }),
      mpResult({ id: "fora-antes", date_approved: "2026-07-31T23:59:59.999-03:00" }),
    ]);
    const POST = await route();

    const body = await (await POST(post({ competencia: "2026-08" }, "true"), ctx())).json();

    expect(body.faltantes.map((f: { mpPaymentId: string }) => f.mpPaymentId)).toEqual(["dentro"]);
  });

  it("importação também respeita o recorte — não grava pagamento de outro mês", async () => {
    umaPagina([mpResult({ id: "fora", date_approved: "2026-09-01T00:00:00.000-03:00" })]);
    const POST = await route();

    await conferirEImportar(POST);

    expect(mocks.recordPayment).not.toHaveBeenCalled();
  });

  /**
   * A competência é o mês do INSTANTE convertido para São Paulo — a mesma
   * regra que o banco recebe via `periodBounds` (`paid_at` é `timestamptz`).
   *
   * O pagamento das 22:00 de 31/08 em São Paulo é 01/09 01:00 UTC. Recortar
   * por UTC o mandaria para setembro enquanto o Caixa o conta em agosto, e
   * aí ele não apareceria em categoria nenhuma na conferência de agosto:
   * "Tudo conferido" com o mês faturando a menos, que é exatamente o que esta
   * rota existe para pegar.
   */
  it("22:00 de 31/08 (São Paulo) é AGOSTO — o mesmo mês em que o banco o grava", async () => {
    umaPagina([
      mpResult({ id: "agosto-tarde", date_approved: "2026-08-31T22:00:00.000-03:00" }),
      mpResult({ id: "julho-tarde", date_approved: "2026-07-31T22:00:00.000-03:00" }),
      mpResult({ id: "setembro-cedo", date_approved: "2026-09-01T00:30:00.000-03:00" }),
    ]);
    const POST = await route();

    const body = await (await POST(post({ competencia: "2026-08" }, "true"), ctx())).json();

    expect(body.faltantes.map((f: { mpPaymentId: string }) => f.mpPaymentId)).toEqual([
      "agosto-tarde",
    ]);
  });

  it("a borda de baixo também: 00:00 do dia 1º entra, 23:59 do último dia anterior não", async () => {
    umaPagina([
      mpResult({ id: "primeiro", date_approved: "2026-08-01T00:00:00.000-03:00" }),
      mpResult({ id: "ultimo-do-anterior", date_approved: "2026-07-31T23:59:59.999-03:00" }),
    ]);
    const POST = await route();

    const body = await (await POST(post({ competencia: "2026-08" }, "true"), ctx())).json();

    expect(body.faltantes.map((f: { mpPaymentId: string }) => f.mpPaymentId)).toEqual(["primeiro"]);
  });
});

// ---------------------------------------------------------------------------
// Importação
// ---------------------------------------------------------------------------

describe("importação (sem ?dry)", () => {
  it("grava o pagamento faltante com os snapshots do pagador e a taxa do MP", async () => {
    umaPagina([mpResult({ id: "999" })]);
    const POST = await route();

    const res = await conferirEImportar(POST);
    const body = await res.json();

    expect(body.dry).toBe(false);
    expect(body.importados).toBe(1);
    expect(mocks.recordPayment).toHaveBeenCalledWith({
      tenant_id: 7,
      tenant_name: "Auto Brasil",
      tenant_document: "12345678000199",
      plan: "pro",
      mp_payment_id: "999",
      mp_preapproval_id: "preap-7",
      gross_cents: 24990,
      fee_cents: 1200,
      net_cents: 23790,
      status: "approved",
      paid_at: "2026-08-15T12:00:00.000-03:00",
      coupon_id: null,
      incomplete: false,
    });
  });

  /**
   * O resumo do `/search` NÃO traz `fee_details` — só o recurso completo do
   * `GET /v1/payments/:id` traz. Sem esse segundo GET, toda linha importada
   * entraria `incomplete` com `net = gross`, e o líquido do console ficaria
   * inflado exatamente nos meses em que o webhook falhou.
   */
  it("relê o pagamento completo no MP antes de gravar (o resumo da busca não traz a taxa)", async () => {
    umaPagina([mpResult({ id: "999" })]);
    mocks.paymentGet.mockResolvedValue(
      mpFull({ id: "999", transaction_details: { net_received_amount: 236.9 } }),
    );
    const POST = await route();

    await conferirEImportar(POST);

    expect(mocks.paymentGet).toHaveBeenCalledWith({ id: "999" });
    expect(mocks.recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({ fee_cents: 1300, net_cents: 23690, incomplete: false }),
    );
  });

  it("importar de novo não duplica: na 2ª rodada a linha já está no banco", async () => {
    umaPagina([mpResult({ id: "999" })]);
    const POST = await route();

    const primeira = await (await conferirEImportar(POST)).json();
    expect(primeira.importados).toBe(1);
    expect(mocks.recordPayment).toHaveBeenCalledTimes(1);

    // 2ª rodada: o banco agora tem a linha que a 1ª criou.
    mocks.listPaymentsByPeriod.mockResolvedValue([
      { id: 1, mp_payment_id: "999", status: "approved" },
    ]);
    const segunda = await (await conferirEImportar(POST)).json();

    expect(segunda.importados).toBe(0);
    expect(segunda.faltantes).toEqual([]);
    expect(mocks.recordPayment).toHaveBeenCalledTimes(1);
  });

  /**
   * Rede de segurança para o pagamento cuja data no MP e no banco caem em
   * meses diferentes: ele não estaria em `listPaymentsByPeriod` desta
   * competência, mas existe — e `mp_payment_id` é UNIQUE.
   */
  it("checa por mp_payment_id antes de gravar e não conta como importado o que já existia", async () => {
    umaPagina([mpResult({ id: "999" })]);
    mocks.getPaymentByMpId.mockResolvedValue({ id: 42, mp_payment_id: "999", status: "approved" });
    const POST = await route();

    const body = await (await conferirEImportar(POST)).json();

    expect(mocks.getPaymentByMpId).toHaveBeenCalledWith("999");
    expect(mocks.recordPayment).not.toHaveBeenCalled();
    expect(body.importados).toBe(0);
  });

  /**
   * A fiação rota → UI dos `pulados`. `avisoDaImportacao` tem teste, mas com
   * fixture montada na mão: se a ROTA parar de contar, a mensagem volta calada
   * ao bug que ela existe para corrigir — atribuir ao teto por rodada o que na
   * verdade foi pulado de propósito. São diagnósticos opostos: um pede rodar
   * de novo, o outro diz que não há o que fazer.
   */
  it("reporta `pulados` — o que a rodada tocou e decidiu não gravar", async () => {
    umaPagina([mpResult({ id: "999" }), mpResult({ id: "1000" })]);
    // As duas linhas já existem: nada a importar, e nada represado.
    mocks.getPaymentByMpId.mockResolvedValue({ id: 42, mp_payment_id: "999", status: "approved" });
    const POST = await route();

    const body = await (await conferirEImportar(POST)).json();

    expect(body.pulados).toBe(2);
    expect(body.importados).toBe(0);
    expect(body.naoProcessados).toBe(0);
    expect(body.falhas).toEqual([]);
  });

  it("importado e pulado convivem na mesma rodada, cada um na sua contagem", async () => {
    umaPagina([mpResult({ id: "999" }), mpResult({ id: "1000" })]);
    mocks.getPaymentByMpId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 42, mp_payment_id: "1000", status: "approved" });
    mocks.recordPayment.mockResolvedValueOnce({ created: true });
    const POST = await route();

    const body = await (await conferirEImportar(POST)).json();

    expect(body.importados).toBe(1);
    expect(body.pulados).toBe(1);
  });

  it("conta como importado só o que o INSERT criou de fato", async () => {
    umaPagina([mpResult({ id: "999" }), mpResult({ id: "1000" })]);
    mocks.recordPayment
      .mockResolvedValueOnce({ created: true })
      // Corrida com o webhook: a linha nasceu entre o SELECT e o INSERT, e o
      // `onConflictDoNothing` não criou nada.
      .mockResolvedValueOnce({ created: false });
    const POST = await route();

    const body = await (await conferirEImportar(POST)).json();

    expect(body.importados).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Divergentes — o patch tem que ser o mesmo do webhook
// ---------------------------------------------------------------------------

describe("divergentes: patch completo, não só o status", () => {
  /** Linha local `pending` sem taxa — o estado que a 1ª notificação deixa. */
  function localPending() {
    mocks.listPaymentsByPeriod.mockResolvedValue([
      { id: 1, mp_payment_id: "999", status: "pending" },
    ]);
    mocks.getPaymentByMpId.mockResolvedValue({
      id: 1,
      mp_payment_id: "999",
      status: "pending",
      gross_cents: 24990,
      fee_cents: null,
      net_cents: 24990,
      incomplete: true,
    });
  }

  it("estorno perdido pelo webhook vira atualização de status, não linha nova", async () => {
    umaPagina([mpResult({ id: "999", status: "refunded" })]);
    mocks.listPaymentsByPeriod.mockResolvedValue([
      { id: 1, mp_payment_id: "999", status: "approved" },
    ]);
    mocks.getPaymentByMpId.mockResolvedValue({
      id: 1, mp_payment_id: "999", status: "approved",
      gross_cents: 24990, fee_cents: 1200, net_cents: 23790, incomplete: false,
    });
    const POST = await route();

    const body = await (await conferirEImportar(POST)).json();

    expect(mocks.updatePayment).toHaveBeenCalledWith(
      "999", expect.objectContaining({ status: "refunded" }),
    );
    expect(mocks.recordPayment).not.toHaveBeenCalled();
    expect(body.atualizados).toBe(1);
    expect(body.importados).toBe(0);
  });

  /**
   * O cenário canônico de webhook perdido: a 1ª notificação gravou `pending`
   * sem taxa e a de aprovação nunca chegou. Corrigir só o `status` deixaria
   * `fee_cents` nulo, `net = gross` e `incomplete: true` — **a mesma inflação
   * de líquido** que o segundo `GET` dos faltantes existe para evitar, e que
   * ninguém veria, porque `incomplete` não é exibido em tela nenhuma.
   */
  it("pending → approved grava taxa, líquido e incomplete, não só o status", async () => {
    umaPagina([mpResult({ id: "999", status: "approved" })]);
    localPending();
    const POST = await route();

    await conferirEImportar(POST);

    expect(mocks.paymentGet).toHaveBeenCalledWith({ id: "999" });
    expect(mocks.updatePayment).toHaveBeenCalledWith("999", {
      status: "approved",
      fee_cents: 1200,
      net_cents: 23790,
      incomplete: false,
      paid_at: "2026-08-15T12:00:00.000-03:00",
    });
  });

  /**
   * `UpdatePaymentInput` (lib/db/payments.ts) existe justamente para barrar
   * isto: bruto, loja, plano e cupom são snapshot do momento do pagamento e
   * uma leitura posterior não os reescreve.
   */
  /**
   * O `paidAt` que chega em `corrigirDivergente` vem do RESUMO do `/search`;
   * a função tem o recurso COMPLETO relido em mãos. Gravar o do resumo tendo
   * o completo é confiar na fonte mais fraca para escrever no registro
   * fiscal — e o webhook já deriva do completo. `paid_at` decide competência,
   * mês do DAS e mês da NFS-e, então a divergência não é cosmética.
   */
  it("paid_at vem do recurso completo relido, não do resumo da busca", async () => {
    umaPagina([mpResult({
      id: "999", status: "approved", date_approved: "2026-08-10T10:00:00.000-03:00",
    })]);
    localPending();
    mocks.paymentGet.mockResolvedValue(mpFull({
      id: "999", date_approved: "2026-08-12T15:30:00.000-03:00",
    }));
    const POST = await route();

    await conferirEImportar(POST);

    const patch = mocks.updatePayment.mock.calls[0][1];
    expect(patch.paid_at).toBe("2026-08-12T15:30:00.000-03:00");
    expect(patch.paid_at).not.toBe("2026-08-10T10:00:00.000-03:00");
  });

  it("se a releitura não trouxer data legível, vale a que já havia sido classificada", async () => {
    umaPagina([mpResult({
      id: "999", status: "approved", date_approved: "2026-08-10T10:00:00.000-03:00",
    })]);
    localPending();
    mocks.paymentGet.mockResolvedValue(mpFull({
      id: "999", date_approved: null, date_created: null,
    }));
    const POST = await route();

    await conferirEImportar(POST);

    const patch = mocks.updatePayment.mock.calls[0][1];
    expect(patch.paid_at).toBe("2026-08-10T10:00:00.000-03:00");
  });

  it("não reescreve o snapshot: nada de bruto, loja, plano ou cupom no patch", async () => {
    umaPagina([mpResult({ id: "999", status: "approved", transaction_amount: 999.99 })]);
    localPending();
    const POST = await route();

    await conferirEImportar(POST);

    const patch = mocks.updatePayment.mock.calls[0][1];
    for (const proibido of ["gross_cents", "tenant_id", "tenant_name", "plan", "coupon_id"]) {
      expect(patch).not.toHaveProperty(proibido);
    }
  });

  it("líquido é derivado do bruto JÁ GRAVADO, não do que o MP mostra agora", async () => {
    // O MP agora diz 999,99; a linha foi gravada com 249,90. A taxa vem do
    // recurso relido, mas o líquido tem que fechar com o bruto da linha.
    umaPagina([mpResult({ id: "999", status: "approved", transaction_amount: 999.99 })]);
    localPending();
    mocks.paymentGet.mockResolvedValue(
      mpFull({ id: "999", transaction_amount: 999.99, fee_details: [{ amount: 12.0 }] }),
    );
    const POST = await route();

    await conferirEImportar(POST);

    expect(mocks.updatePayment).toHaveBeenCalledWith(
      "999", expect.objectContaining({ fee_cents: 1200, net_cents: 23790 }),
    );
  });

  it("linha que sumiu entre a conferência e a importação não vira update às cegas", async () => {
    umaPagina([mpResult({ id: "999", status: "approved" })]);
    mocks.listPaymentsByPeriod.mockResolvedValue([
      { id: 1, mp_payment_id: "999", status: "pending" },
    ]);
    mocks.getPaymentByMpId.mockResolvedValue(null);
    const POST = await route();

    const body = await (await conferirEImportar(POST)).json();

    expect(mocks.updatePayment).not.toHaveBeenCalled();
    expect(body.atualizados).toBe(0);
  });

  /**
   * A guarda de regressão roda DUAS vezes: na classificação e de novo na hora
   * de gravar, contra o estado relido. Entre a conferência e a confirmação o
   * webhook pode ter entregue o estorno.
   */
  it("relê o status antes de gravar — estorno que chegou no meio não é revertido", async () => {
    umaPagina([mpResult({ id: "999", status: "approved" })]);
    mocks.listPaymentsByPeriod.mockResolvedValue([
      { id: 1, mp_payment_id: "999", status: "pending" },
    ]);
    // No momento da gravação a linha já é `refunded` (o webhook chegou).
    mocks.getPaymentByMpId.mockResolvedValue({
      id: 1, mp_payment_id: "999", status: "refunded",
      gross_cents: 24990, fee_cents: 1200, net_cents: 23790, incomplete: false,
    });
    const POST = await route();

    const body = await (await conferirEImportar(POST)).json();

    expect(mocks.updatePayment).not.toHaveBeenCalled();
    expect(body.atualizados).toBe(0);
  });

  it("NÃO reverte um refunded gravado para o approved que o MP ainda mostra", async () => {
    umaPagina([mpResult({ id: "999", status: "approved" })]);
    mocks.listPaymentsByPeriod.mockResolvedValue([
      { id: 1, mp_payment_id: "999", status: "refunded" },
    ]);
    const POST = await route();

    const body = await (await conferirEImportar(POST)).json();

    expect(mocks.updatePayment).not.toHaveBeenCalled();
    expect(mocks.recordPayment).not.toHaveBeenCalled();
    expect(body.divergentes).toEqual([]);
  });

  it("charged_back do MP em cima de approved local é aplicado", async () => {
    umaPagina([mpResult({ id: "999", status: "charged_back" })]);
    mocks.listPaymentsByPeriod.mockResolvedValue([
      { id: 1, mp_payment_id: "999", status: "approved" },
    ]);
    mocks.getPaymentByMpId.mockResolvedValue({
      id: 1, mp_payment_id: "999", status: "approved",
      gross_cents: 24990, fee_cents: 1200, net_cents: 23790, incomplete: false,
    });
    const POST = await route();

    await conferirEImportar(POST);

    expect(mocks.updatePayment).toHaveBeenCalledWith(
      "999", expect.objectContaining({ status: "charged_back" }),
    );
  });
});

// ---------------------------------------------------------------------------
// Lote: teto, falha por item, concorrência
// ---------------------------------------------------------------------------

describe("lote de importação", () => {
  it("declara maxDuration — o lote faz N chamadas ao MP e o default da Vercel é curto", async () => {
    const mod = await import("@/app/api/superadmin/payments/reconciliar/route");
    expect(mod.maxDuration).toBeGreaterThanOrEqual(60);
  });

  /**
   * Antes, uma falha em qualquer id abortava tudo dali para frente. Como a
   * ordem é `date_approved asc`, um id envenenado (429, recurso inacessível)
   * bloqueava PERMANENTEMENTE todos os posteriores: rodar de novo esbarrava
   * no mesmo id, na mesma posição.
   */
  it("falha num id não aborta o lote — os outros entram e o que falhou é reportado", async () => {
    umaPagina([mpResult({ id: "a" }), mpResult({ id: "b" }), mpResult({ id: "c" })]);
    mocks.paymentGet.mockImplementation(async ({ id }: { id: string }) => {
      if (id === "b") throw new Error("429 Too Many Requests");
      return mpFull({ id });
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const POST = await route();

    const res = await conferirEImportar(POST);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.importados).toBe(2);
    expect(body.falhas).toHaveLength(1);
    expect(body.falhas[0].mpPaymentId).toBe("b");
    const gravados = mocks.recordPayment.mock.calls.map((c) => c[0].mp_payment_id);
    expect(gravados.sort()).toEqual(["a", "c"]);
  });

  it("o que falhou nunca some em silêncio: aparece com motivo", async () => {
    umaPagina([mpResult({ id: "a" })]);
    mocks.paymentGet.mockRejectedValue(new Error("recurso inacessível"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const POST = await route();

    const body = await (await conferirEImportar(POST)).json();

    expect(body.importados).toBe(0);
    expect(body.falhas[0].motivo).toBeTruthy();
  });

  /**
   * Teto por rodada. Sem ele são até 1000 `GET` sequenciais numa função com
   * timeout — a rota estouraria e o operador não saberia o que entrou.
   */
  it("acima do teto por rodada, o resto sobra para a próxima e é declarado", async () => {
    paginado(Array.from({ length: 130 }, (_, i) => mpResult({ id: `p${i}` })));
    const POST = await route();

    const body = await (await conferirEImportar(POST)).json();

    expect(body.importados).toBe(100);
    expect(body.naoProcessados).toBe(30);
    expect(mocks.recordPayment).toHaveBeenCalledTimes(100);
  });

  it("dentro do teto, nada sobra", async () => {
    umaPagina([mpResult({ id: "999" })]);
    const POST = await route();

    const body = await (await conferirEImportar(POST)).json();

    expect(body.naoProcessados).toBe(0);
    expect(body.falhas).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// A confirmação é amarrada ao conjunto conferido
// ---------------------------------------------------------------------------

describe("confirmação amarrada ao conjunto conferido", () => {
  it("o dry devolve um token do que foi mostrado", async () => {
    umaPagina([mpResult({ id: "999" })]);
    const POST = await route();

    const body = await (await POST(post({ competencia: "2026-08" }, "true"), ctx())).json();

    expect(typeof body.token).toBe("string");
    expect(body.token.length).toBeGreaterThan(0);
  });

  it("importar sem token é 400 — não dá para confirmar o que não foi conferido", async () => {
    umaPagina([mpResult({ id: "999" })]);
    const POST = await route();

    const res = await POST(post({ competencia: "2026-08" }), ctx());

    expect(res.status).toBe(400);
    expect(mocks.recordPayment).not.toHaveBeenCalled();
  });

  /**
   * O ponto: para `faltantes` reimportar é inócuo, mas para `divergentes`
   * não. Um estorno que chegue entre a conferência e a confirmação teria o
   * status gravado sem o operador nunca ter visto — ele confirmaria um
   * número, não um conjunto.
   */
  it("estorno que aparece entre as duas etapas invalida o token e nada é gravado", async () => {
    umaPagina([mpResult({ id: "999" })]);
    const POST = await route();
    const { token } = await (await POST(post({ competencia: "2026-08" }, "true"), ctx())).json();

    // Entre a conferência e a confirmação, o MP passou a mostrar mais um.
    umaPagina([mpResult({ id: "999" }), mpResult({ id: "1000", status: "refunded" })]);
    const res = await POST(post({ competencia: "2026-08", token }), ctx());

    expect(res.status).toBe(409);
    expect(mocks.recordPayment).not.toHaveBeenCalled();
    expect(mocks.updatePayment).not.toHaveBeenCalled();
  });

  it("a mensagem do 409 diz o que fazer", async () => {
    umaPagina([mpResult({ id: "999" })]);
    const POST = await route();
    const res = await POST(post({ competencia: "2026-08", token: "token-de-outra-conferencia" }), ctx());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/confir|confer/i);
  });

  it("token da competência errada não vale para outra", async () => {
    umaPagina([mpResult({ id: "999" })]);
    const POST = await route();
    const { token } = await (await POST(post({ competencia: "2026-08" }, "true"), ctx())).json();

    mocks.periodBounds.mockReturnValue(periodoDaCompetencia("2026-07"));
    umaPagina([mpResult({ id: "999", date_approved: "2026-07-15T12:00:00.000-03:00" })]);
    const res = await POST(post({ competencia: "2026-07", token }), ctx());

    expect(res.status).toBe(409);
    expect(mocks.recordPayment).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Pagamentos que não dá para importar
// ---------------------------------------------------------------------------

describe("pagamentos que não viram linha", () => {
  it("sem external_reference de tenant fica visível em 'ignorados' e não é gravado", async () => {
    umaPagina([mpResult({ id: "avulso", external_reference: undefined })]);
    const POST = await route();

    const body = await (await conferirEImportar(POST)).json();

    expect(mocks.recordPayment).not.toHaveBeenCalled();
    expect(body.faltantes).toEqual([]);
    expect(body.ignorados).toHaveLength(1);
    expect(body.ignorados[0].mpPaymentId).toBe("avulso");
  });

  it("tenant que não existe mais fica em 'ignorados' — não se inventa nome de pagador", async () => {
    umaPagina([mpResult({ id: "orfao", external_reference: "404" })]);
    mocks.getTenantById.mockResolvedValue(null);
    const POST = await route();

    const body = await (await conferirEImportar(POST)).json();

    expect(mocks.recordPayment).not.toHaveBeenCalled();
    expect(body.ignorados[0].mpPaymentId).toBe("orfao");
  });

  it("pagamento sem data nenhuma não é jogado no mês da reconciliação", async () => {
    umaPagina([mpResult({ id: "sem-data", date_approved: undefined, date_created: undefined })]);
    const POST = await route();

    const body = await (await conferirEImportar(POST)).json();

    expect(mocks.recordPayment).not.toHaveBeenCalled();
    expect(body.faltantes).toEqual([]);
    expect(body.ignorados[0].mpPaymentId).toBe("sem-data");
  });

  /**
   * Era a única categoria que sumia em silêncio — descartada com um `continue`
   * mudo, contra a regra do próprio módulo (nada que veio do MP desaparece
   * sem o operador ver).
   */
  it("pagamento sem id também aparece em 'ignorados' em vez de sumir", async () => {
    umaPagina([mpResult({ id: undefined })]);
    const POST = await route();

    const body = await (await conferirEImportar(POST)).json();

    expect(body.ignorados).toHaveLength(1);
    expect(body.ignorados[0].motivo).toMatch(/id/i);
    expect(mocks.recordPayment).not.toHaveBeenCalled();
  });

  /**
   * O número da tela precisa fechar: "N encontrados · M já registrados" só faz
   * sentido se N for o total DA COMPETÊNCIA, não o bruto da janela (que é
   * maior de propósito — ver a folga de um dia da busca).
   */
  it("encontradosMp fecha a conta com as quatro categorias", async () => {
    umaPagina([
      mpResult({ id: "falta" }),
      mpResult({ id: "diverge", status: "refunded" }),
      mpResult({ id: "ok" }),
      mpResult({ id: "ignora", external_reference: undefined }),
      // Fora da competência: entra na janela larga do MP, não na conta.
      mpResult({ id: "outro-mes", date_approved: "2026-09-10T12:00:00.000-03:00" }),
    ]);
    mocks.listPaymentsByPeriod.mockResolvedValue([
      { id: 1, mp_payment_id: "diverge", status: "approved" },
      { id: 2, mp_payment_id: "ok", status: "approved" },
    ]);
    const POST = await route();

    const body = await (await POST(post({ competencia: "2026-08" }, "true"), ctx())).json();

    expect(body.faltantes).toHaveLength(1);
    expect(body.divergentes).toHaveLength(1);
    expect(body.jaRegistrados).toBe(1);
    expect(body.ignorados).toHaveLength(1);
    expect(body.encontradosMp).toBe(4);
  });

  it("resolve o tenant pelo external_reference do pagamento, não por um id fixo", async () => {
    umaPagina([mpResult({ id: "999", external_reference: "42" })]);
    const POST = await route();

    await POST(post({ competencia: "2026-08" }, "true"), ctx());

    expect(mocks.getTenantById).toHaveBeenCalledWith(42);
  });
});
