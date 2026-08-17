import { describe, it, expect, vi, beforeEach } from "vitest";

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

const AGOSTO = { from: "2026-08-01T00:00:00.000Z", to: "2026-09-01T00:00:00.000Z" };

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
    // um dia de folga de cada lado. O MP filtra por INSTANTE e a competência é
    // relógio de parede: sem a folga, o pagamento das 22:00 de 31/08 (que o
    // banco conta em agosto) nem sequer voltaria da busca de agosto. Quem
    // recorta de verdade é `dentroDaCompetencia`, em cima do que voltou.
    expect(options.begin_date).toBe("2026-07-31T00:00:00.000Z");
    expect(options.end_date).toBe("2026-09-02T00:00:00.000Z");
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
    expect(body.consultadosMp).toBe(51);
  });

  it("MP fora do ar vira 502 e não grava nada", async () => {
    mocks.paymentSearch.mockRejectedValue(new Error("MP fora do ar"));
    const POST = await route();

    const res = await POST(post({ competencia: "2026-08" }), ctx());

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

    const res = await POST(post({ competencia: "2026-08" }), ctx());

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
    umaPagina([
      mpResult({ id: "dentro", date_approved: "2026-08-31T23:59:59.000Z" }),
      mpResult({ id: "fora-depois", date_approved: "2026-09-01T00:00:00.000Z" }),
      mpResult({ id: "fora-antes", date_approved: "2026-07-31T23:59:59.999Z" }),
    ]);
    const POST = await route();

    const body = await (await POST(post({ competencia: "2026-08" }, "true"), ctx())).json();

    expect(body.faltantes.map((f: { mpPaymentId: string }) => f.mpPaymentId)).toEqual(["dentro"]);
  });

  it("importação também respeita o recorte — não grava pagamento de outro mês", async () => {
    umaPagina([mpResult({ id: "fora", date_approved: "2026-09-01T00:00:00.000Z" })]);
    const POST = await route();

    await POST(post({ competencia: "2026-08" }), ctx());

    expect(mocks.recordPayment).not.toHaveBeenCalled();
  });

  /**
   * A competência é decidida pelo relógio de parede que o Postgres grava
   * (`paid_at` é `timestamp` SEM time zone: o offset do MP é descartado na
   * gravação). Com `-03:00`, esse relógio é o de São Paulo.
   *
   * Um recorte por instante mandaria o pagamento das 22:00 de 31/08 para
   * setembro enquanto o banco o conta em agosto — e aí ele não apareceria em
   * categoria nenhuma na conferência de agosto: "Tudo conferido" com o mês
   * faturando a menos, que é exatamente o que esta rota existe para pegar.
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

    const res = await POST(post({ competencia: "2026-08" }), ctx());
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

    await POST(post({ competencia: "2026-08" }), ctx());

    expect(mocks.paymentGet).toHaveBeenCalledWith({ id: "999" });
    expect(mocks.recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({ fee_cents: 1300, net_cents: 23690, incomplete: false }),
    );
  });

  it("importar de novo não duplica: na 2ª rodada a linha já está no banco", async () => {
    umaPagina([mpResult({ id: "999" })]);
    const POST = await route();

    const primeira = await (await POST(post({ competencia: "2026-08" }), ctx())).json();
    expect(primeira.importados).toBe(1);
    expect(mocks.recordPayment).toHaveBeenCalledTimes(1);

    // 2ª rodada: o banco agora tem a linha que a 1ª criou.
    mocks.listPaymentsByPeriod.mockResolvedValue([
      { id: 1, mp_payment_id: "999", status: "approved" },
    ]);
    const segunda = await (await POST(post({ competencia: "2026-08" }), ctx())).json();

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

    const body = await (await POST(post({ competencia: "2026-08" }), ctx())).json();

    expect(mocks.getPaymentByMpId).toHaveBeenCalledWith("999");
    expect(mocks.recordPayment).not.toHaveBeenCalled();
    expect(body.importados).toBe(0);
  });

  it("conta como importado só o que o INSERT criou de fato", async () => {
    umaPagina([mpResult({ id: "999" }), mpResult({ id: "1000" })]);
    mocks.recordPayment
      .mockResolvedValueOnce({ created: true })
      // Corrida com o webhook: a linha nasceu entre o SELECT e o INSERT, e o
      // `onConflictDoNothing` não criou nada.
      .mockResolvedValueOnce({ created: false });
    const POST = await route();

    const body = await (await POST(post({ competencia: "2026-08" }), ctx())).json();

    expect(body.importados).toBe(1);
  });

  /**
   * A importação não é transacional. Se o MP cair no meio, o que já entrou
   * fica — e a mensagem tem que dizer isso, porque a saída é rodar a
   * conferência de novo (que é idempotente), não achar que nada aconteceu.
   */
  it("MP falhando no meio da importação: o que já entrou fica, e a mensagem avisa", async () => {
    umaPagina([mpResult({ id: "999" }), mpResult({ id: "1000" })]);
    mocks.paymentGet
      .mockResolvedValueOnce(mpFull({ id: "999" }))
      .mockRejectedValueOnce(new Error("MP fora do ar"));
    const POST = await route();

    const res = await POST(post({ competencia: "2026-08" }), ctx());
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(mocks.recordPayment).toHaveBeenCalledTimes(1);
    expect(body.error).toMatch(/rode a conferência de novo/i);
  });

  it("estorno perdido pelo webhook vira atualização de status, não linha nova", async () => {
    umaPagina([mpResult({ id: "999", status: "refunded" })]);
    mocks.listPaymentsByPeriod.mockResolvedValue([
      { id: 1, mp_payment_id: "999", status: "approved" },
    ]);
    const POST = await route();

    const body = await (await POST(post({ competencia: "2026-08" }), ctx())).json();

    expect(mocks.updatePayment).toHaveBeenCalledWith("999", { status: "refunded" });
    expect(mocks.recordPayment).not.toHaveBeenCalled();
    expect(body.atualizados).toBe(1);
    expect(body.importados).toBe(0);
  });

  it("NÃO reverte um refunded gravado para o approved que o MP ainda mostra", async () => {
    umaPagina([mpResult({ id: "999", status: "approved" })]);
    mocks.listPaymentsByPeriod.mockResolvedValue([
      { id: 1, mp_payment_id: "999", status: "refunded" },
    ]);
    const POST = await route();

    const body = await (await POST(post({ competencia: "2026-08" }), ctx())).json();

    expect(mocks.updatePayment).not.toHaveBeenCalled();
    expect(mocks.recordPayment).not.toHaveBeenCalled();
    expect(body.divergentes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Pagamentos que não dá para importar
// ---------------------------------------------------------------------------

describe("pagamentos que não viram linha", () => {
  it("sem external_reference de tenant fica visível em 'ignorados' e não é gravado", async () => {
    umaPagina([mpResult({ id: "avulso", external_reference: undefined })]);
    const POST = await route();

    const body = await (await POST(post({ competencia: "2026-08" }), ctx())).json();

    expect(mocks.recordPayment).not.toHaveBeenCalled();
    expect(body.faltantes).toEqual([]);
    expect(body.ignorados).toHaveLength(1);
    expect(body.ignorados[0].mpPaymentId).toBe("avulso");
  });

  it("tenant que não existe mais fica em 'ignorados' — não se inventa nome de pagador", async () => {
    umaPagina([mpResult({ id: "orfao", external_reference: "404" })]);
    mocks.getTenantById.mockResolvedValue(null);
    const POST = await route();

    const body = await (await POST(post({ competencia: "2026-08" }), ctx())).json();

    expect(mocks.recordPayment).not.toHaveBeenCalled();
    expect(body.ignorados[0].mpPaymentId).toBe("orfao");
  });

  it("pagamento sem data nenhuma não é jogado no mês da reconciliação", async () => {
    umaPagina([mpResult({ id: "sem-data", date_approved: undefined, date_created: undefined })]);
    const POST = await route();

    const body = await (await POST(post({ competencia: "2026-08" }), ctx())).json();

    expect(mocks.recordPayment).not.toHaveBeenCalled();
    expect(body.faltantes).toEqual([]);
  });

  it("resolve o tenant pelo external_reference do pagamento, não por um id fixo", async () => {
    umaPagina([mpResult({ id: "999", external_reference: "42" })]);
    const POST = await route();

    await POST(post({ competencia: "2026-08" }, "true"), ctx());

    expect(mocks.getTenantById).toHaveBeenCalledWith(42);
  });
});
