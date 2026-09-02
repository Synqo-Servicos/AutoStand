import { describe, it, expect, vi } from "vitest";
import { PLANS, ENTRY_PLAN } from "@/lib/plans";

// `@/lib/diag` importa ApiError de `@/lib/api`, que arrasta next-auth pro grafo
// do módulo (next-auth importa "next/server" sem extensão e quebra no ESM do
// vitest). Mesmo padrão de tests/api/payables-anexos.test.ts.
vi.mock("@/lib/auth", () => ({ auth: vi.fn(), getApiTenantId: vi.fn() }));

const { diagAmountCents, diagCoupon } = await import("@/lib/diag");

describe("diagnóstico de pagamento", () => {
  it("cobra R$ 1,00 do cartão real", () => {
    expect(diagAmountCents()).toBe(100);
  });

  it("o desconto sai do preço vigente do plano, não de um número fixo", () => {
    // Sem isto, mudar o preço de tabela transforma o diagnóstico de R$ 1,00
    // numa cobrança de verdade no cartão de quem rodar o teste.
    expect(diagCoupon(0).discount_value).toBe(PLANS[ENTRY_PLAN].priceMonthly - 100);
  });
});
