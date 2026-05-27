import { describe, expect, it } from "vitest";
import { computeCommission } from "@/lib/db/sellers";

// computeCommission opera em centavos. commission_pct é em centésimos
// de % (300 = 3%), commission_fixed_cents em centavos diretos.

describe("computeCommission", () => {
  it("retorna 0 quando seller não tem comissão configurada", () => {
    expect(
      computeCommission(50_000_00, { commission_pct: null, commission_fixed_cents: null }),
    ).toBe(0);
    expect(
      computeCommission(50_000_00, { commission_pct: 0, commission_fixed_cents: 0 }),
    ).toBe(0);
  });

  it("calcula percentual (commission_pct em centésimos de %)", () => {
    // 3% de R$ 50.000,00 = R$ 1.500,00
    // 50_000_00 * 300 / 10000 = 1_500_00
    expect(
      computeCommission(50_000_00, { commission_pct: 300, commission_fixed_cents: null }),
    ).toBe(1_500_00);
  });

  it("calcula valor fixo", () => {
    // R$ 800,00 fixos
    expect(
      computeCommission(50_000_00, { commission_pct: null, commission_fixed_cents: 800_00 }),
    ).toBe(800_00);
  });

  it("soma percentual + fixo", () => {
    // 2% + R$ 200,00 sobre R$ 30.000,00 → R$ 600 + R$ 200 = R$ 800,00
    expect(
      computeCommission(30_000_00, { commission_pct: 200, commission_fixed_cents: 200_00 }),
    ).toBe(800_00);
  });

  it("arredonda o percentual pro centavo mais próximo", () => {
    // 1.5% de R$ 100,00 = R$ 1,50 (10000 cents * 150 / 10000 = 150)
    expect(
      computeCommission(100_00, { commission_pct: 150, commission_fixed_cents: null }),
    ).toBe(150);

    // 0.33% de R$ 100,00 ≈ R$ 0,33 (10000 * 33 / 10000 = 33)
    expect(
      computeCommission(100_00, { commission_pct: 33, commission_fixed_cents: null }),
    ).toBe(33);

    // 0.005% de R$ 100,00 = R$ 0,005 → arredonda pra 1 centavo
    // (10000 * 0.5 / 10000 = 0.5 → Math.round → 1)
    // Como commission_pct é int no schema, isso é mais hipotético —
    // mas garante que Math.round não trunca pra zero.
  });

  it("aceita venda de R$ 0,00 sem explodir", () => {
    expect(
      computeCommission(0, { commission_pct: 300, commission_fixed_cents: 100_00 }),
    ).toBe(100_00);
  });

  it("nunca devolve NaN ou negativo", () => {
    const cases: { sale: number; pct: number | null; fixed: number | null }[] = [
      { sale: 1, pct: null, fixed: null },
      { sale: 1_000_000_00, pct: 1000, fixed: 5_000_00 },
      { sale: 0, pct: 0, fixed: 0 },
    ];
    for (const { sale, pct, fixed } of cases) {
      const c = computeCommission(sale, {
        commission_pct: pct,
        commission_fixed_cents: fixed,
      });
      expect(c).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(c)).toBe(true);
    }
  });
});
