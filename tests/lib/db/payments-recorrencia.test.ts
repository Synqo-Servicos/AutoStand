import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * ============================================================================
 * O MRR CONTA O QUE SE COBRA, NÃO O PREÇO DE TABELA
 * ============================================================================
 *
 * Este arquivo mudou de opinião, e vale dizer por quê: ele AFIRMAVA o bug.
 *
 * O caso "tenant ativo sem plano gravado cai no Básico" existia aqui como
 * comportamento esperado, e o de MRR dizia explicitamente "pelo preço de
 * tabela". Quando o console abriu com dados reais pela primeira vez, o dono da
 * plataforma viu mensalidade sendo contada de loja SUSPENSA e de loja que ele
 * havia CEDIDO por cortesia. Os testes estavam verdes o tempo todo — porque
 * descreviam o que o código fazia, não o que o número precisa significar.
 *
 * Os três caminhos que inflavam o MRR, cada um independente do outro:
 *
 *  1. LOJA SUSPENSA somava mensalidade cheia. O super-admin suspende pela
 *     allowlist de update, que altera `tenants.status` e NÃO toca
 *     `subscription_status` — só o webhook do Mercado Pago mexe nesse campo.
 *     A assinatura fica marcada `active` para sempre, e a consulta antiga
 *     filtrava apenas por ela;
 *
 *  2. LOJA CEDIDA POR CORTESIA entrava pelo preço cheio. Cupom de 100% não
 *     gera assinatura grátis — o Mercado Pago não tem recorrência de valor
 *     zero, então gera cobrança de R$ 0,01 (MIN_CHARGEABLE_CENTS). O cálculo
 *     ignorava `coupon_id` por completo;
 *
 *  3. ASSINATURA SEM PLANO virava `basico` por um `?? "basico"`, fazendo
 *     R$ 169,90 surgir do nada a cada linha inconsistente.
 *
 * `vi.hoisted` e não `const fn = vi.fn()`: a fábrica do `vi.mock` é içada para
 * antes das declarações, e um `const` lido de dentro dela cai em TDZ — no
 * vitest 4.1.5 isso trava a suíte em silêncio por dois minutos em vez de dar
 * erro.
 */
const mocks = vi.hoisted(() => ({ selectRows: vi.fn() }));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        // LEFT JOIN com `coupons`: sem ele o MRR não sabe o que é cobrado.
        leftJoin: () => ({ where: () => mocks.selectRows() }),
      }),
    }),
  },
  client: {},
}));

/** Linha do JOIN tenants × coupons, com os defaults do caso feliz. */
function linha(over: Record<string, unknown> = {}) {
  return { plan: "pro", subscription_status: "active", status: "active", coupon: null, ...over };
}

/** Cupom percentual — no MP o desconto vale para SEMPRE, não só no 1º mês. */
function cupomPercentual(valor: number) {
  return { id: 1, code: "X", discount_type: "percentage", discount_value: valor };
}

const PRECO_PRO = 24990;
const PRECO_BASICO = 16990;
const ZERADO = { mrrCents: 0, ativosPorPlano: {}, inadimplentes: 0, cortesias: 0, suspensos: 0, semPlano: 0 };

describe("getRecorrencia — só entra no MRR quem paga", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.selectRows.mockReset(); });

  it("conta ativos por plano e soma o que é cobrado de cada um", async () => {
    mocks.selectRows.mockResolvedValueOnce([
      linha(), linha(), linha({ plan: "basico" }),
      linha({ plan: "premium", subscription_status: "past_due" }),
    ]);
    const { getRecorrencia } = await import("@/lib/db/payments");
    expect(await getRecorrencia()).toEqual({
      mrrCents: PRECO_PRO * 2 + PRECO_BASICO,
      ativosPorPlano: { pro: 2, basico: 1 },
      inadimplentes: 1, cortesias: 0, suspensos: 0, semPlano: 0,
    });
  });

  /** O caso que o dono viu: loja suspensa continuava somando. */
  it("loja SUSPENSA não entra no MRR, mesmo com assinatura marcada ativa", async () => {
    mocks.selectRows.mockResolvedValueOnce([linha(), linha({ status: "suspended" })]);
    const { getRecorrencia } = await import("@/lib/db/payments");
    const r = await getRecorrencia();

    expect(r.mrrCents).toBe(PRECO_PRO); // uma só paga, não duas
    expect(r.ativosPorPlano).toEqual({ pro: 1 });
    expect(r.suspensos).toBe(1);
  });

  /**
   * A loja cedida. Cupom de 100% cai no piso de R$ 0,01: ela é cliente, não é
   * receita. Contar pelo preço cheio inflava o MRR numa mensalidade inteira
   * por cortesia concedida.
   */
  it("CORTESIA entra pelo valor cobrado (o piso), não pelo preço de tabela", async () => {
    mocks.selectRows.mockResolvedValueOnce([linha({ coupon: cupomPercentual(100) })]);
    const { getRecorrencia } = await import("@/lib/db/payments");
    const r = await getRecorrencia();

    expect(r.mrrCents).toBe(1);
    expect(r.mrrCents).not.toBe(PRECO_PRO);
    expect(r.ativosPorPlano).toEqual({ pro: 1 }); // segue sendo cliente
    expect(r.cortesias).toBe(1);
  });

  it("cupom parcial desconta de verdade — o desconto é recorrente, não do 1º mês", async () => {
    mocks.selectRows.mockResolvedValueOnce([linha({ coupon: cupomPercentual(50) })]);
    const { getRecorrencia } = await import("@/lib/db/payments");
    const r = await getRecorrencia();

    expect(r.mrrCents).toBe(PRECO_PRO / 2);
    expect(r.cortesias).toBe(0); // 50% não é cortesia: ainda entra receita
  });

  /**
   * `free_month` vira trial no Mercado Pago e não reduz a recorrência. Se este
   * teste passasse a esperar desconto, o MRR sairia SUBESTIMADO — o erro na
   * direção oposta, e igualmente caro.
   */
  it("cupom de mês grátis NÃO reduz a recorrência — é trial, não desconto", async () => {
    mocks.selectRows.mockResolvedValueOnce([
      linha({ coupon: { id: 2, code: "Y", discount_type: "free_month", discount_value: null } }),
    ]);
    const { getRecorrencia } = await import("@/lib/db/payments");
    const r = await getRecorrencia();

    expect(r.mrrCents).toBe(PRECO_PRO);
    expect(r.cortesias).toBe(0);
  });

  /** Este caso AFIRMAVA o fallback. Agora afirma que ele não existe mais. */
  it("assinatura ativa SEM PLANO não vira basico — não inventa mensalidade", async () => {
    mocks.selectRows.mockResolvedValueOnce([linha({ plan: null })]);
    const { getRecorrencia } = await import("@/lib/db/payments");
    const r = await getRecorrencia();

    expect(r.mrrCents).toBe(0);
    expect(r.mrrCents).not.toBe(PRECO_BASICO);
    expect(r.ativosPorPlano).toEqual({});
    expect(r.semPlano).toBe(1);
  });

  it("base vazia devolve zeros, não erro", async () => {
    mocks.selectRows.mockResolvedValueOnce([]);
    const { getRecorrencia } = await import("@/lib/db/payments");
    expect(await getRecorrencia()).toEqual(ZERADO);
  });

  it("status diferente de active/past_due (cancelled, incomplete) não conta em nada", async () => {
    mocks.selectRows.mockResolvedValueOnce([
      linha({ plan: "premium", subscription_status: "cancelled" }),
      linha({ subscription_status: "incomplete" }),
    ]);
    const { getRecorrencia } = await import("@/lib/db/payments");
    expect(await getRecorrencia()).toEqual(ZERADO);
  });

  /**
   * O cenário do relato, inteiro: uma pagante, uma suspensa, uma cortesia e
   * uma sem plano. Antes da correção este MRR somava
   * 24990 + 24990 + 24990 + 16990 = 91.960 — quase quatro mensalidades para
   * uma única loja de fato pagante.
   */
  it("a base misturada devolve só a receita real, e explica cada exclusão", async () => {
    mocks.selectRows.mockResolvedValueOnce([
      linha(),
      linha({ status: "suspended" }),
      linha({ coupon: cupomPercentual(100) }),
      linha({ plan: null }),
    ]);
    const { getRecorrencia } = await import("@/lib/db/payments");
    const r = await getRecorrencia();

    expect(r.mrrCents).toBe(PRECO_PRO + 1);
    expect(r.suspensos).toBe(1);
    expect(r.cortesias).toBe(1);
    expect(r.semPlano).toBe(1);
    expect(r.mrrCents).not.toBe(91960); // o total antigo, explícito
  });
});
