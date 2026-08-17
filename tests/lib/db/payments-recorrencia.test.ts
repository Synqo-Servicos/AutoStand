import { describe, it, expect, vi, beforeEach } from "vitest";

const selectWhere = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (cond: unknown) => selectWhere(cond),
      }),
    }),
  },
  client: {},
}));

describe("getRecorrencia", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("conta ativos por plano e soma o MRR pelo preço de tabela do plano corrente", async () => {
    selectWhere.mockResolvedValueOnce([
      { plan: "pro", subscription_status: "active" },
      { plan: "pro", subscription_status: "active" },
      { plan: "basico", subscription_status: "active" },
      { plan: "premium", subscription_status: "past_due" },
    ]);
    const { getRecorrencia } = await import("@/lib/db/payments");
    const result = await getRecorrencia();
    // pro = R$ 249,90 × 2 + básico = R$ 169,90 — preço de tabela de lib/plans.ts
    expect(result).toEqual({
      mrrCents: 24990 * 2 + 16990,
      ativosPorPlano: { pro: 2, basico: 1 },
      inadimplentes: 1,
    });
  });

  it("tenant ativo sem plano gravado cai no Básico — mesmo fallback de getPlan", async () => {
    selectWhere.mockResolvedValueOnce([{ plan: null, subscription_status: "active" }]);
    const { getRecorrencia } = await import("@/lib/db/payments");
    const result = await getRecorrencia();
    expect(result).toEqual({ mrrCents: 16990, ativosPorPlano: { basico: 1 }, inadimplentes: 0 });
  });

  it("base vazia devolve zeros, não erro", async () => {
    selectWhere.mockResolvedValueOnce([]);
    const { getRecorrencia } = await import("@/lib/db/payments");
    const result = await getRecorrencia();
    expect(result).toEqual({ mrrCents: 0, ativosPorPlano: {}, inadimplentes: 0 });
  });

  it("status diferente de active/past_due (cancelled, incomplete) não conta em nada", async () => {
    selectWhere.mockResolvedValueOnce([
      { plan: "premium", subscription_status: "cancelled" },
      { plan: "pro", subscription_status: "incomplete" },
    ]);
    const { getRecorrencia } = await import("@/lib/db/payments");
    const result = await getRecorrencia();
    expect(result).toEqual({ mrrCents: 0, ativosPorPlano: {}, inadimplentes: 0 });
  });
});
