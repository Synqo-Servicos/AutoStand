import { describe, it, expect } from "vitest";
import { PLANS, PLAN_SLUGS, capabilitiesFor, getPlan, isPlanSlug } from "@/lib/plans";

describe("catálogo de planos", () => {
  it("vende dois planos: Pro (a entrada) e Premium", () => {
    expect(PLAN_SLUGS).toEqual(["pro", "premium"]);
    expect(PLANS.pro.priceMonthly).toBe(24990);
    expect(PLANS.premium.priceMonthly).toBe(34990);
  });

  it("'basico' não é mais um plano — o tier foi descontinuado", () => {
    expect(isPlanSlug("basico")).toBe(false);
  });

  it("plano ausente, desconhecido ou legado cai no Pro, a porta de entrada", () => {
    expect(getPlan(null).slug).toBe("pro");
    expect(getPlan(undefined).slug).toBe("pro");
    expect(getPlan("basico").slug).toBe("pro");
  });

  it("a inteligência é a única coisa que separa os dois planos", () => {
    const pro = capabilitiesFor("pro");
    const premium = capabilitiesFor("premium");

    // Tudo que faz o site ser um site está nos dois.
    for (const cap of ["customColors", "layoutConfig", "customDomain", "instagramPost"] as const) {
      expect(pro[cap]).toBe(true);
      expect(premium[cap]).toBe(true);
    }

    expect(pro.aiAnalysis).toBe(false);
    expect(pro.marketInsights).toBe(false);
    expect(premium.aiAnalysis).toBe(true);
    expect(premium.marketInsights).toBe(true);
  });
});
