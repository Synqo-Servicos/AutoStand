import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const insertValues = vi.fn();
const insertReturning = vi.fn();
const selectWhere = vi.fn();
const selectRows = vi.fn();
const updateSetArgs = vi.fn();
const updateWhereArgs = vi.fn();
const updateReturning = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {
    insert: () => ({
      values: (v: unknown) => { insertValues(v); return {
        onConflictDoNothing: () => ({ returning: () => insertReturning() }),
      }; },
    }),
    select: () => ({ from: () => ({
      where: (cond: unknown) => {
        selectWhere(cond);
        return { orderBy: () => selectRows(), limit: () => selectRows() };
      },
    }) }),
    update: () => ({
      set: (v: unknown) => { updateSetArgs(v); return {
        where: (cond: unknown) => { updateWhereArgs(cond); return { returning: () => updateReturning() }; },
      }; },
    }),
  },
  client: {},
}));

describe("recordPayment", () => {
  beforeEach(() => { vi.clearAllMocks(); insertReturning.mockReset(); });

  it("grava e reporta created quando a linha entrou", async () => {
    insertReturning.mockResolvedValueOnce([{ id: 1 }]);
    const { recordPayment } = await import("@/lib/db/payments");
    const r = await recordPayment({
      tenant_id: 7, tenant_name: "Auto Brasil", tenant_document: "12345678000199",
      plan: "pro", mp_payment_id: "mp-1", mp_preapproval_id: "pre-1",
      gross_cents: 24990, fee_cents: 1200, net_cents: 23790,
      status: "approved", paid_at: "2026-08-15T12:00:00Z", coupon_id: null, incomplete: false,
    });
    expect(r.created).toBe(true);
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ mp_payment_id: "mp-1" }));
  });

  it("é idempotente — segunda vez não cria", async () => {
    insertReturning.mockResolvedValueOnce([]);
    const { recordPayment } = await import("@/lib/db/payments");
    const r = await recordPayment({
      tenant_id: 7, tenant_name: "Auto Brasil", tenant_document: null, plan: "pro",
      mp_payment_id: "mp-1", mp_preapproval_id: null,
      gross_cents: 24990, fee_cents: null, net_cents: null,
      status: "approved", paid_at: "2026-08-15T12:00:00Z", coupon_id: null, incomplete: true,
    });
    expect(r.created).toBe(false);
  });

  it("descarta campo malicioso no input — só a allowlist é gravada", async () => {
    insertReturning.mockResolvedValueOnce([{ id: 1 }]);
    const { recordPayment } = await import("@/lib/db/payments");
    await recordPayment({
      tenant_id: 7, tenant_name: "X", tenant_document: null, plan: null,
      mp_payment_id: "mp-2", mp_preapproval_id: null,
      gross_cents: 100, fee_cents: null, net_cents: null,
      status: "approved", paid_at: "2026-08-15T12:00:00Z", coupon_id: null, incomplete: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...( { nfse_number: "FALSO", id: 999 } as any ),
    });
    const arg = insertValues.mock.calls[0][0];
    expect(arg).not.toHaveProperty("nfse_number");
    expect(arg).not.toHaveProperty("id");
  });
});

/**
 * Compila a condição REAL passada ao `.where()`. Asserção sobre o predicado
 * inteiro (texto e parâmetros), nunca `contains`: já houve aqui um teste que
 * passava com `IS NULL` em qualquer coluna porque só procurava a substring
 * `"is null"`, e um `contains("<")` sobrevive tanto a `<` quanto a `<=`.
 */
function predicadoDe(cond: SQL): { sql: string; params: unknown[] } {
  const { sql, params } = new PgDialect().sqlToQuery(cond);
  return { sql, params: params as unknown[] };
}

/** Agosto/2026 em São Paulo, como instantes absolutos. */
const AGOSTO_FROM = "2026-08-01T03:00:00.000Z";
const AGOSTO_TO = "2026-09-01T03:00:00.000Z";

describe("periodBounds", () => {
  it("os limites são a meia-noite de SÃO PAULO, não a de UTC", async () => {
    const { periodBounds } = await import("@/lib/db/payments");
    // 00:00 em São Paulo é 03:00Z. Com 00:00Z, as 21h–24h do dia 31 cairiam
    // no mês errado — o buraco que esta branch existe para fechar.
    expect(periodBounds("2026-08")).toMatchObject({
      from: AGOSTO_FROM,
      to: AGOSTO_TO,
    });
  });

  it("periodBounds('2026-12') atravessa a virada de ano", async () => {
    const { periodBounds } = await import("@/lib/db/payments");
    expect(periodBounds("2026-12")).toMatchObject({
      from: "2026-12-01T03:00:00.000Z",
      to: "2027-01-01T03:00:00.000Z",
    });
  });

  it("é semiaberto: o `to` de um mês é o `from` do seguinte", async () => {
    const { periodBounds } = await import("@/lib/db/payments");
    expect(periodBounds("2026-08").to).toBe(periodBounds("2026-09").from);
  });
});

/**
 * ============================================================================
 * AS DUAS FRONTEIRAS DO PERÍODO, AMARRADAS NO SQL COMPILADO
 * ============================================================================
 *
 * Estes testes existem porque as duas mutações abaixo sobreviveram à suíte
 * inteira, 100% verde:
 *
 *  - `gte` → `gt` no limite INFERIOR: um pagamento às `00:00:00.000` do dia 1º
 *    some do Caixa e da base do DAS. Assinatura mensal é justamente o que mais
 *    cai em meia-noite;
 *  - `lte` → `lt` (e o inverso) no limite SUPERIOR: um pagamento na virada
 *    exata conta em dois meses seguidos, e dentro do array do RBT12 é somado
 *    duas vezes na mesma apuração.
 *
 * Por isso a asserção é sobre o predicado INTEIRO — texto e parâmetros — e não
 * sobre a presença de um operador.
 */
describe("listPaymentsByPeriod — as duas fronteiras do período", () => {
  beforeEach(() => { vi.clearAllMocks(); selectRows.mockReset(); });

  it("o WHERE é exatamente `paid_at >= from AND paid_at < to`", async () => {
    selectRows.mockResolvedValueOnce([]);
    const { listPaymentsByPeriod } = await import("@/lib/db/payments");
    await listPaymentsByPeriod("2026-08");

    const { sql, params } = predicadoDe(selectWhere.mock.calls[0][0] as SQL);
    expect(sql).toBe('("payments"."paid_at" >= $1 and "payments"."paid_at" < $2)');
    // E os limites são os de São Paulo — o predicado certo sobre a janela
    // errada erraria a competência do mesmo jeito.
    expect(params).toEqual([AGOSTO_FROM, AGOSTO_TO]);
  });
});

/**
 * A fila fiscal é o gatilho de uma ação irreversível fora do sistema: o
 * contador lê esta lista e emite NFS-e na prefeitura. Um pagamento que
 * reaparece aqui vira nota emitida DUAS VEZES — e o 409 de `registerNfse`
 * não protege disso, porque ele só dispara quando o contador volta pra
 * registrar o número, ou seja, depois de a nota já existir juridicamente.
 *
 * Por isso os testes abaixo provam a FORMA do SQL (condição real compilada
 * por `PgDialect`, mesma técnica de `listPaymentsByPeriod`), não que a
 * função foi chamada: o mock de `db` ignora o `where`, então qualquer
 * asserção sobre linhas devolvidas sobreviveria à remoção do filtro.
 */
describe("listPendingNfse — a fila só pode conter o que ainda não virou nota", () => {
  beforeEach(() => { vi.clearAllMocks(); selectRows.mockReset(); });

  it("o WHERE exige nfse_issued_at IS NULL — pagamento já emitido não volta pra fila", async () => {
    selectRows.mockResolvedValueOnce([]);
    const { listPendingNfse } = await import("@/lib/db/payments");
    await listPendingNfse();

    const condition = selectWhere.mock.calls[0][0] as SQL;
    const compiled = new PgDialect().sqlToQuery(condition).sql.toLowerCase();
    // Coluna nomeada de propósito: um `is null` solto poderia vir de
    // qualquer outra coluna nullable e o teste passaria por acidente.
    expect(compiled).toContain('"nfse_issued_at" is null');
  });

  it("o WHERE exige status = 'approved' — estorno e chargeback não entram na fila", async () => {
    selectRows.mockResolvedValueOnce([]);
    const { listPendingNfse } = await import("@/lib/db/payments");
    await listPendingNfse();

    const { sql: compiled, params } = new PgDialect().sqlToQuery(
      selectWhere.mock.calls[0][0] as SQL,
    );
    // O valor viaja como parâmetro ($1), não inline no SQL — por isso a
    // asserção é em duas partes: a coluna aparece na condição, e
    // "approved" é o valor de fato ligado a ela.
    expect(compiled.toLowerCase()).toContain('"status" =');
    expect(params).toContain("approved");
  });

  it("as duas condições andam juntas num AND — nenhuma delas sozinha basta", async () => {
    selectRows.mockResolvedValueOnce([]);
    const { listPendingNfse } = await import("@/lib/db/payments");
    await listPendingNfse();

    const compiled = new PgDialect()
      .sqlToQuery(selectWhere.mock.calls[0][0] as SQL).sql.toLowerCase();
    expect(compiled).toContain("and");
  });

  /**
   * O predicado inteiro da fila, pelo mesmo motivo do teste equivalente em
   * `registerNfse`: as asserções acima são substrings e substring não
   * detecta conjunto REMOVIDO. Aqui o mutante perigoso é perder
   * `nfse_issued_at IS NULL` — a fila voltaria a listar pagamento que já
   * virou nota, e o contador emitiria a MESMA NFS-e duas vezes na
   * prefeitura, que é o erro que não tem desfazer dentro deste sistema.
   */
  it("o WHERE da fila é exatamente status + nfse_issued_at IS NULL", async () => {
    selectRows.mockResolvedValueOnce([]);
    const { listPendingNfse } = await import("@/lib/db/payments");
    await listPendingNfse();

    const { sql: compiled, params } = new PgDialect().sqlToQuery(
      selectWhere.mock.calls[0][0] as SQL,
    );
    expect(compiled.toLowerCase()).toBe(
      '("payments"."status" = $1 and "payments"."nfse_issued_at" is null)',
    );
    expect(params).toEqual(["approved"]);
  });
});

describe("sumCaixa", () => {
  beforeEach(() => { vi.clearAllMocks(); selectRows.mockReset(); });

  it("soma só pagamentos approved — estorno e chargeback ficam de fora", async () => {
    selectRows.mockResolvedValueOnce([
      { status: "approved", gross_cents: 10000, fee_cents: 500, incomplete: false },
      { status: "refunded", gross_cents: 20000, fee_cents: 1000, incomplete: false },
      { status: "chargeback", gross_cents: 30000, fee_cents: 1500, incomplete: false },
      { status: "approved", gross_cents: 5000, fee_cents: 250, incomplete: false },
    ]);
    const { sumCaixa } = await import("@/lib/db/payments");
    const result = await sumCaixa("2026-08");
    expect(result).toEqual({ gross: 15000, fee: 750, netBeforeTax: 14250, incompletos: 0 });
  });

  /**
   * `fee ?? 0` é o ponto onde uma taxa DESCONHECIDA vira uma taxa de ZERO na
   * soma — e um líquido superestimado na taxa inteira. O número não pode
   * deixar de ser somado (o bruto é real e a competência precisa fechar),
   * então a saída é CONTAR quantas linhas entraram assim, para a tela poder
   * dizer que aquele líquido é um teto, não um valor.
   *
   * Sem esta contagem, `incomplete` é uma coluna que ninguém lê — que era
   * exatamente o estado antes desta correção.
   */
  describe("incompletos — quantas linhas entraram com a taxa desconhecida", () => {
    it("conta a linha marcada com incomplete", async () => {
      selectRows.mockResolvedValueOnce([
        { status: "approved", gross_cents: 24990, fee_cents: null, incomplete: true },
        { status: "approved", gross_cents: 10000, fee_cents: 500, incomplete: false },
      ]);
      const { sumCaixa } = await import("@/lib/db/payments");
      const result = await sumCaixa("2026-08");

      expect(result.incompletos).toBe(1);
      // O bruto continua inteiro e a taxa conhecida continua somada — a
      // linha incompleta não é descartada, só sinalizada.
      expect(result.gross).toBe(34990);
      expect(result.fee).toBe(500);
    });

    /**
     * `fee_cents` nulo com `incomplete: false` é o que uma linha gravada
     * antes da coluna existir (ou corrigida à mão no banco) tem. A soma
     * usa `?? 0` nela do mesmo jeito, então ela infla o líquido do mesmo
     * jeito — contar só pela flag deixaria esse caso invisível.
     */
    it("conta também a linha com fee_cents nulo que não está marcada", async () => {
      selectRows.mockResolvedValueOnce([
        { status: "approved", gross_cents: 24990, fee_cents: null, incomplete: false },
      ]);
      const { sumCaixa } = await import("@/lib/db/payments");
      expect((await sumCaixa("2026-08")).incompletos).toBe(1);
    });

    it("não conta linha que não é approved — ela não entra no caixa de qualquer jeito", async () => {
      selectRows.mockResolvedValueOnce([
        { status: "refunded", gross_cents: 24990, fee_cents: null, incomplete: true },
        { status: "approved", gross_cents: 10000, fee_cents: 500, incomplete: false },
      ]);
      const { sumCaixa } = await import("@/lib/db/payments");
      expect((await sumCaixa("2026-08")).incompletos).toBe(0);
    });
  });
});

/**
 * `sumGrossBetween` alimenta a RBT12, que decide a alíquota efetiva e o DAS.
 * Ele era o único fetcher de período com convenção INCLUSIVA dos dois lados,
 * enquanto `listPaymentsByPeriod` era semiaberto — e a única coisa que
 * segurava a diferença era uma função em OUTRO arquivo
 * (`mesBoundsInclusivos`) que encolhia o `to` em 1 ms. Nenhum teste amarrava o
 * operador no SQL: trocar `lte` por `lt` passava verde.
 *
 * As duas convenções agora são uma só (semiaberto), e é o predicado compilado
 * que trava isso.
 */
describe("sumGrossBetween — mesma fronteira de listPaymentsByPeriod", () => {
  beforeEach(() => { vi.clearAllMocks(); selectRows.mockReset(); });

  it("o WHERE é exatamente `paid_at >= from AND paid_at < to`", async () => {
    selectRows.mockResolvedValueOnce([]);
    const { periodBounds, sumGrossBetween } = await import("@/lib/db/payments");
    await sumGrossBetween(periodBounds("2026-08"));

    const { sql, params } = predicadoDe(selectWhere.mock.calls[0][0] as SQL);
    expect(sql).toBe('("payments"."paid_at" >= $1 and "payments"."paid_at" < $2)');
    expect(params).toEqual([AGOSTO_FROM, AGOSTO_TO]);
  });

  it("usa o MESMO predicado que listPaymentsByPeriod para a mesma competência", async () => {
    selectRows.mockResolvedValue([]);
    const mod = await import("@/lib/db/payments");

    await mod.listPaymentsByPeriod("2026-08");
    const daLista = predicadoDe(selectWhere.mock.calls[0][0] as SQL);
    selectWhere.mockClear();
    await mod.sumGrossBetween(mod.periodBounds("2026-08"));
    const daSoma = predicadoDe(selectWhere.mock.calls[0][0] as SQL);

    // Caixa e base do DAS não podem discordar sobre quais linhas são do mês:
    // é a mesma tela mostrando os dois números.
    expect(daSoma).toEqual(daLista);
  });

  it("soma só approved — estorno não entra na base do DAS", async () => {
    selectRows.mockResolvedValueOnce([
      { status: "approved", gross: 10000 },
      { status: "refunded", gross: 20000 },
      { status: "chargeback", gross: 30000 },
      { status: "approved", gross: 5000 },
    ]);
    const { periodBounds, sumGrossBetween } = await import("@/lib/db/payments");
    expect(await sumGrossBetween(periodBounds("2026-08"))).toBe(15000);
  });
});

describe("getPaymentByMpId", () => {
  beforeEach(() => { vi.clearAllMocks(); selectRows.mockReset(); });

  it("devolve a linha quando o mp_payment_id existe", async () => {
    selectRows.mockResolvedValueOnce([{ id: 1, mp_payment_id: "mp-1", status: "approved" }]);
    const { getPaymentByMpId } = await import("@/lib/db/payments");
    const row = await getPaymentByMpId("mp-1");
    expect(row).toEqual({ id: 1, mp_payment_id: "mp-1", status: "approved" });
  });

  it("devolve null quando o mp_payment_id não existe", async () => {
    selectRows.mockResolvedValueOnce([]);
    const { getPaymentByMpId } = await import("@/lib/db/payments");
    const row = await getPaymentByMpId("mp-inexistente");
    expect(row).toBeNull();
  });
});

describe("updatePayment", () => {
  beforeEach(() => { vi.clearAllMocks(); updateReturning.mockReset(); });

  it("aplica um patch parcial — status, taxa e líquido na mesma escrita", async () => {
    updateReturning.mockResolvedValueOnce([
      { id: 1, mp_payment_id: "mp-1", status: "approved", fee_cents: 1200, net_cents: 23790, incomplete: false },
    ]);
    const { updatePayment } = await import("@/lib/db/payments");
    const row = await updatePayment("mp-1", {
      status: "approved", fee_cents: 1200, net_cents: 23790, incomplete: false,
    });
    expect(row).toEqual(
      { id: 1, mp_payment_id: "mp-1", status: "approved", fee_cents: 1200, net_cents: 23790, incomplete: false },
    );
    expect(updateSetArgs).toHaveBeenCalledWith({
      status: "approved", fee_cents: 1200, net_cents: 23790, incomplete: false,
    });
  });

  it("um patch sem `status` não manda a chave no SET — não sobrescreve status por acidente", async () => {
    updateReturning.mockResolvedValueOnce([{ id: 1, mp_payment_id: "mp-1" }]);
    const { updatePayment } = await import("@/lib/db/payments");
    await updatePayment("mp-1", { paid_at: "2026-08-15T12:00:00.000Z" });
    const setArg = updateSetArgs.mock.calls[0][0];
    expect(setArg).toEqual({ paid_at: "2026-08-15T12:00:00.000Z" });
    expect(setArg).not.toHaveProperty("status");
  });

  it("devolve null quando o mp_payment_id não existe", async () => {
    updateReturning.mockResolvedValueOnce([]);
    const { updatePayment } = await import("@/lib/db/payments");
    const row = await updatePayment("mp-inexistente", { status: "refunded" });
    expect(row).toBeNull();
  });

  /**
   * O maior raio de dano da branch, e o gatilho mais corriqueiro que existe.
   *
   * Trocar `.where(eq(...))` por `.where(undefined)` mantinha os 734 testes
   * verdes. Isso é `UPDATE payments SET ... ` SEM WHERE: uma reentrega de
   * webhook do Mercado Pago — rotina, não exceção — carimbaria o status, a
   * taxa, o líquido e o `paid_at` de UM pagamento em TODAS as linhas da
   * tabela. Todo o histórico fiscal da plataforma vira cópia do último evento
   * recebido.
   *
   * O mock já capturava `updateWhereArgs`; o que faltava era alguém olhar.
   * Nenhum teste do bloco assere o WHERE — todos asserem o SET —, então o
   * predicado inteiro podia sumir sem ruído.
   *
   * Igualdade exata do SQL compilado e dos params, e não `toContain`: a lição
   * que este arquivo já aprendeu três vezes é que substring não detecta
   * CONJUNTO REMOVIDO. Um `contains('"mp_payment_id" =')` passaria feliz com
   * um WHERE que ganhasse um `OR 1=1` do lado.
   */
  it("o WHERE é exatamente mp_payment_id = ? — nunca a tabela inteira", async () => {
    updateReturning.mockResolvedValueOnce([{ id: 1, mp_payment_id: "mp-1" }]);
    const { updatePayment } = await import("@/lib/db/payments");
    await updatePayment("mp-1", { status: "refunded" });

    expect(updateWhereArgs).toHaveBeenCalledTimes(1);
    const cond = updateWhereArgs.mock.calls[0][0];
    // Um `.where(undefined)` chega aqui como undefined e o Postgres receberia
    // um UPDATE sem cláusula nenhuma. Barra isso antes de compilar.
    expect(cond).toBeDefined();

    const { sql, params } = predicadoDe(cond as SQL);
    expect(sql.toLowerCase()).toBe('"payments"."mp_payment_id" = $1');
    expect(params).toEqual(["mp-1"]);
  });

  /**
   * Herdado de `updatePaymentStatus`, que foi removida por não ter mais
   * chamador nenhum (era da Task 2, substituída por esta na Task 3 da mesma
   * branch). A propriedade, porém, é do caminho do ESTORNO, não daquela
   * função: o MP reentrega notificação, e um UPDATE puro por
   * `mp_payment_id` — sem incremento nem acúmulo — precisa convergir no
   * mesmo resultado quando aplicado duas vezes.
   */
  it("é idempotente — o mesmo patch duas vezes manda o mesmo UPDATE e converge", async () => {
    const depois = { id: 1, mp_payment_id: "mp-1", status: "refunded" };
    // `mockResolvedValueOnce` duas vezes (não um mock fixo): cada chamada
    // consome sua própria resposta. Se a implementação deixasse de chamar
    // `db.update` na segunda invocação, a fila ficaria com resposta não
    // consumida e o `toHaveBeenCalledTimes(2)` abaixo cairia.
    updateReturning.mockResolvedValueOnce([depois]);
    updateReturning.mockResolvedValueOnce([depois]);
    const { updatePayment } = await import("@/lib/db/payments");

    expect(await updatePayment("mp-1", { status: "refunded" })).toEqual(depois);
    expect(await updatePayment("mp-1", { status: "refunded" })).toEqual(depois);

    expect(updateSetArgs).toHaveBeenNthCalledWith(1, { status: "refunded" });
    expect(updateSetArgs).toHaveBeenNthCalledWith(2, { status: "refunded" });
    expect(updateReturning).toHaveBeenCalledTimes(2);
  });
});

describe("registerNfse", () => {
  beforeEach(() => { vi.clearAllMocks(); updateReturning.mockReset(); });

  it("grava numero, nfse_issued_at e nfse_issued_by quando ainda não há nota", async () => {
    updateReturning.mockResolvedValueOnce([{ id: 1, nfse_number: "123", nfse_issued_by: 7 }]);
    const { registerNfse } = await import("@/lib/db/payments");
    const row = await registerNfse(1, "123", 7);
    expect(row).toEqual({ id: 1, nfse_number: "123", nfse_issued_by: 7 });
    expect(updateSetArgs).toHaveBeenCalledWith(
      expect.objectContaining({ nfse_number: "123", nfse_issued_by: 7 }),
    );
  });

  // Prova estrutural do guard de idempotência: compila a condição real
  // passada pro `.where()` (mesma técnica do teste de `listPaymentsByPeriod`
  // acima) e confirma que ela exige `nfse_issued_at IS NULL` — não só "id
  // bate". Remover `isNull(payments.nfse_issued_at)` do WHERE em
  // lib/db/payments.ts derruba este teste (verificado por mutação, ver
  // task-6-report.md).
  it("o WHERE exige nfse_issued_at IS NULL — não só o id do pagamento", async () => {
    updateReturning.mockResolvedValueOnce([{ id: 1 }]);
    const { registerNfse } = await import("@/lib/db/payments");
    await registerNfse(1, "123", 7);

    const condition = updateWhereArgs.mock.calls[0][0] as SQL;
    const compiled = new PgDialect().sqlToQuery(condition).sql.toLowerCase();
    expect(compiled).toContain('"nfse_issued_at" is null');
  });

  /**
   * Sem predicado de status, o `where` era `id = ? AND nfse_issued_at IS
   * NULL` — qualquer linha de `payments` podia ser carimbada. Uma sessão de
   * `contador` (a credencial mais fraca do console) mandando POST para os
   * ids 1..N esvaziaria a fila carimbando também `refunded`, `chargeback` e
   * `pending`, que a UI nunca mostra.
   */
  it("o WHERE exige status = 'approved' — refunded/chargeback/pending não podem ser carimbados", async () => {
    updateReturning.mockResolvedValueOnce([{ id: 1 }]);
    const { registerNfse } = await import("@/lib/db/payments");
    await registerNfse(1, "123", 7);

    const { sql: compiled, params } = new PgDialect().sqlToQuery(
      updateWhereArgs.mock.calls[0][0] as SQL,
    );
    expect(compiled.toLowerCase()).toContain('"status" =');
    expect(params).toContain("approved");
  });

  /**
   * O predicado INTEIRO, não um `contains` de pedaço dele.
   *
   * Por que a diferença importa: as duas asserções acima são substrings, e
   * substring sobrevive a CONJUNTO REMOVIDO. Verificado por mutação —
   * apagar `eq(payments.id, paymentId)` do WHERE, deixando só
   * `status = 'approved' AND nfse_issued_at IS NULL`, mantinha a suíte
   * inteira verde (668/668). E esse é o pior mutante possível deste
   * arquivo: um único POST em /nfse carimbaria TODA linha aprovada e ainda
   * não emitida da tabela com o MESMO número de nota — a fila fiscal
   * esvaziaria de uma vez, e cada pagamento do histórico ficaria vinculado
   * a uma nota que não é a dele.
   *
   * Igualdade exata do SQL compilado + dos params é o que fecha isso: prende
   * as três condições, a ordem delas, as COLUNAS de cada uma (trocar
   * `nfse_issued_at` por outra coluna nullable falha aqui) e os valores
   * ligados. Qualquer conjunto a mais ou a menos derruba.
   */
  it("o WHERE é exatamente id + status + nfse_issued_at IS NULL — nada a mais, nada a menos", async () => {
    updateReturning.mockResolvedValueOnce([{ id: 1 }]);
    const { registerNfse } = await import("@/lib/db/payments");
    await registerNfse(42, "123", 7);

    const { sql: compiled, params } = new PgDialect().sqlToQuery(
      updateWhereArgs.mock.calls[0][0] as SQL,
    );
    expect(compiled.toLowerCase()).toBe(
      '("payments"."id" = $1 and "payments"."status" = $2 and "payments"."nfse_issued_at" is null)',
    );
    // O id do pagamento está de fato LIGADO ao predicado — é o conjunto que
    // separa "carimba esta linha" de "carimba a tabela".
    expect(params).toEqual([42, "approved"]);
  });

  it("registrar duas vezes o mesmo pagamento — a 2ª chamada não altera o número já gravado (devolve null)", async () => {
    // 1ª chamada: nfse_issued_at ainda é NULL -> UPDATE afeta 1 linha.
    updateReturning.mockResolvedValueOnce([{ id: 1, nfse_number: "111", nfse_issued_by: 7 }]);
    // 2ª chamada: no banco real, nfse_issued_at já não é mais NULL, então a
    // condição do WHERE não bate em nenhuma linha -> UPDATE afeta 0 linhas.
    // Simulamos aqui o resultado desse WHERE não bater (não há Postgres
    // real neste teste) — é o comportamento que a asserção acima prova que
    // a query pede.
    updateReturning.mockResolvedValueOnce([]);

    const { registerNfse } = await import("@/lib/db/payments");
    const first = await registerNfse(1, "111", 7);
    const second = await registerNfse(1, "222", 9);

    expect(first).toEqual({ id: 1, nfse_number: "111", nfse_issued_by: 7 });
    expect(second).toBeNull();
    // A 2ª chamada tentou "222" no SET — mas como o mock representa "0
    // linhas afetadas" (o WHERE não bateu), o retorno é null: o número
    // "111" da 1ª chamada nunca é sobrescrito no banco.
    expect(updateSetArgs).toHaveBeenNthCalledWith(2, expect.objectContaining({ nfse_number: "222" }));
  });

  it("devolve null quando o id do pagamento não existe", async () => {
    updateReturning.mockResolvedValueOnce([]);
    const { registerNfse } = await import("@/lib/db/payments");
    const row = await registerNfse(999, "123", 7);
    expect(row).toBeNull();
  });
});

/**
 * Invariante entre as duas funções, não sobre cada uma: se um pagamento não
 * pode ENTRAR na fila, ele também não pode ser CARIMBADO. As duas condições
 * são montadas a partir do mesmo predicado em lib/db/payments.ts; este teste
 * é o que impede alguém de afrouxar uma das duas e deixar a outra para trás.
 */
describe("listPendingNfse × registerNfse — critério de elegibilidade compartilhado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectRows.mockReset();
    updateReturning.mockReset();
  });

  it("os dois WHEREs ligam o MESMO status — fila e carimbo não podem divergir", async () => {
    selectRows.mockResolvedValueOnce([]);
    updateReturning.mockResolvedValueOnce([{ id: 1 }]);
    const { listPendingNfse, registerNfse } = await import("@/lib/db/payments");

    await listPendingNfse();
    await registerNfse(1, "123", 7);

    const dialect = new PgDialect();
    const fila = dialect.sqlToQuery(selectWhere.mock.calls[0][0] as SQL);
    const carimbo = dialect.sqlToQuery(updateWhereArgs.mock.calls[0][0] as SQL);

    // O status elegível é o mesmo nas duas queries. `registerNfse` liga o id
    // além dele, então a comparação é por conteúdo do status, não pelo array
    // inteiro de params.
    const statusDaFila = fila.params.filter((p) => typeof p === "string");
    expect(statusDaFila).toEqual(["approved"]);
    expect(carimbo.params).toContain("approved");

    // E as duas exigem que a nota ainda não exista.
    expect(fila.sql.toLowerCase()).toContain('"nfse_issued_at" is null');
    expect(carimbo.sql.toLowerCase()).toContain('"nfse_issued_at" is null');
  });
});

/**
 * Caminho de reversão — restrito a `super_admin` na rota (ver
 * tests/api/payments-nfse.test.ts). Aqui só a forma do SQL.
 */
describe("clearNfse", () => {
  beforeEach(() => { vi.clearAllMocks(); updateReturning.mockReset(); });

  it("limpa os três campos de NFS-e — nenhum resíduo de vínculo fica pra trás", async () => {
    updateReturning.mockResolvedValueOnce([{ id: 1, nfse_number: null }]);
    const { clearNfse } = await import("@/lib/db/payments");
    await clearNfse(1);

    expect(updateSetArgs).toHaveBeenCalledWith({
      nfse_number: null,
      nfse_issued_at: null,
      nfse_issued_by: null,
    });
  });

  /**
   * Espelho exato do mutante fechado em `registerNfse` — e aqui o estrago é
   * pior, porque é destrutivo.
   *
   * Apagar `eq(payments.id, paymentId)` do WHERE mantinha os 734 verdes: o
   * predicado virava só `nfse_issued_at IS NOT NULL`, e UM
   * `DELETE /api/superadmin/payments/1/nfse` limparia `nfse_number`,
   * `nfse_issued_at` e `nfse_issued_by` de TODA linha que tem nota. A trilha
   * de NFS-e inteira da plataforma, de uma vez — e IRRECONSTRUÍVEL, porque
   * não existe tabela de log: nada guarda qual número estava em qual
   * pagamento antes.
   *
   * O teste antigo usava `toContain('"nfse_issued_at" is not null')`, que
   * continua verdadeiro depois de remover o `eq(id)`. Substring não detecta
   * conjunto removido — é a terceira vez que este arquivo tropeça nisso.
   */
  it("o WHERE é exatamente id + nfse_issued_at IS NOT NULL — nada a mais, nada a menos", async () => {
    updateReturning.mockResolvedValueOnce([{ id: 1 }]);
    const { clearNfse } = await import("@/lib/db/payments");
    await clearNfse(1);

    const { sql, params } = predicadoDe(updateWhereArgs.mock.calls[0][0] as SQL);
    expect(sql.toLowerCase()).toBe(
      '("payments"."id" = $1 and "payments"."nfse_issued_at" is not null)',
    );
    // O id ligado ao predicado é o que separa "desfaz esta linha" de
    // "apaga a trilha fiscal da plataforma".
    expect(params).toEqual([1]);
  });

  it("devolve null quando nada foi limpo (id inexistente ou sem nota)", async () => {
    updateReturning.mockResolvedValueOnce([]);
    const { clearNfse } = await import("@/lib/db/payments");
    expect(await clearNfse(999)).toBeNull();
  });
});

describe("getPaymentById", () => {
  beforeEach(() => { vi.clearAllMocks(); selectRows.mockReset(); });

  it("devolve a linha quando o id existe", async () => {
    selectRows.mockResolvedValueOnce([{ id: 1, status: "refunded" }]);
    const { getPaymentById } = await import("@/lib/db/payments");
    expect(await getPaymentById(1)).toEqual({ id: 1, status: "refunded" });
  });

  it("devolve null quando o id não existe", async () => {
    selectRows.mockResolvedValueOnce([]);
    const { getPaymentById } = await import("@/lib/db/payments");
    expect(await getPaymentById(999)).toBeNull();
  });
});
