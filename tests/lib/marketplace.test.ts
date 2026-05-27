import { describe, expect, it } from "vitest";
import { tenantSiteUrl } from "@/lib/marketplace";

// PLATFORM_DOMAIN no test cai no fallback "autostand.com.br" (lowercased).
const PLATFORM = (process.env.PLATFORM_DOMAIN ?? "autostand.com.br").trim().toLowerCase();

describe("tenantSiteUrl", () => {
  it("usa custom_domain quando setado", () => {
    expect(
      tenantSiteUrl({ slug: "autoprime", custom_domain: "autoprime.com.br" }),
    ).toBe("https://autoprime.com.br");
  });

  it("cai no subdomínio quando custom_domain é null", () => {
    expect(
      tenantSiteUrl({ slug: "autoprime", custom_domain: null }),
    ).toBe(`https://autoprime.${PLATFORM}`);
  });

  it("cai no subdomínio quando custom_domain é string vazia", () => {
    expect(
      tenantSiteUrl({ slug: "garagem082", custom_domain: "" }),
    ).toBe(`https://garagem082.${PLATFORM}`);
  });

  it("trim no custom_domain", () => {
    expect(
      tenantSiteUrl({ slug: "x", custom_domain: "  loja.com  " }),
    ).toBe("https://loja.com");
  });

  it("sempre devolve HTTPS", () => {
    const url = tenantSiteUrl({ slug: "qualquer", custom_domain: null });
    expect(url.startsWith("https://")).toBe(true);
  });
});
