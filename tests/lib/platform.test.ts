import { describe, expect, it } from "vitest";
import {
  PLATFORM_DOMAIN, PLATFORM_DOMAIN_LC, PLATFORM_ORIGIN,
  CONSOLE_HOST, tenantSubdomain,
} from "@/lib/platform";

describe("lib/platform", () => {
  // O env não está setado no ambiente de teste — vai cair no fallback
  // "autostand.com.br". Quem rodar com PLATFORM_DOMAIN definido pega
  // o valor de lá.
  const expected = (process.env.PLATFORM_DOMAIN ?? "autostand.com.br").trim();

  it("PLATFORM_DOMAIN reflete o env (com fallback)", () => {
    expect(PLATFORM_DOMAIN).toBe(expected);
  });

  it("PLATFORM_DOMAIN_LC é lowercase", () => {
    expect(PLATFORM_DOMAIN_LC).toBe(expected.toLowerCase());
  });

  it("PLATFORM_ORIGIN é o domínio com https://", () => {
    expect(PLATFORM_ORIGIN).toBe(`https://${expected}`);
  });

  it("CONSOLE_HOST é console.<dominio>", () => {
    expect(CONSOLE_HOST).toBe(`console.${expected}`);
  });

  it("tenantSubdomain prefixa slug com ponto", () => {
    expect(tenantSubdomain("autoprime")).toBe(`autoprime.${expected}`);
    expect(tenantSubdomain("garagem082")).toBe(`garagem082.${expected}`);
  });
});
