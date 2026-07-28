import { describe, expect, it } from "vitest";
import { computeCommission } from "@/lib/commission";

// commission_pct é em centésimos de % (300 = 3%); valores em centavos.

describe("computeCommission (módulo puro, usado também no cliente)", () => {
  it("soma percentual e parcela fixa", () => {
    // 3% de R$ 50.000,00 = R$ 1.500,00, mais R$ 800,00 fixos
    expect(
      computeCommission(50_000_00, { commission_pct: 300, commission_fixed_cents: 800_00 }),
    ).toBe(2_300_00);
  });

  it("retorna 0 quando o vendedor não tem comissão configurada", () => {
    expect(
      computeCommission(50_000_00, { commission_pct: null, commission_fixed_cents: null }),
    ).toBe(0);
  });

  it("arredonda o percentual pro centavo mais próximo", () => {
    // 1,5% de R$ 3.333,33 = R$ 49,99995 → R$ 50,00
    expect(
      computeCommission(333_333, { commission_pct: 150, commission_fixed_cents: null }),
    ).toBe(50_00);
  });
});
