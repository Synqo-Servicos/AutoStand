import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PLATFORM_DOMAIN, PLATFORM_DOMAIN_LC, PLATFORM_ORIGIN,
  CONSOLE_HOST, tenantSubdomain, mpNotificationUrl,
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

describe("mpNotificationUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  const expected = (process.env.PLATFORM_DOMAIN ?? "autostand.com.br").trim();

  it("aponta pro apex da plataforma + path real da rota do webhook", () => {
    expect(mpNotificationUrl()).toBe(`${PLATFORM_ORIGIN}/api/webhooks/mercadopago`);
    expect(mpNotificationUrl()).toBe(`https://${expected}/api/webhooks/mercadopago`);
  });

  it("respeita PLATFORM_DOMAIN (não hardcoda autostand.com.br)", async () => {
    vi.resetModules();
    vi.stubEnv("PLATFORM_DOMAIN", "staging.exemplo.com.br");
    const mod = await import("@/lib/platform");
    expect(mod.mpNotificationUrl()).toBe("https://staging.exemplo.com.br/api/webhooks/mercadopago");
    expect(mod.mpNotificationUrl()).not.toContain("autostand.com.br");
  });

  it("é sempre HTTPS e nunca aponta pro host de um tenant", () => {
    const url = mpNotificationUrl();
    expect(url.startsWith("https://")).toBe(true);
    // O webhook é server-to-server: tem que bater no apex, onde a rota
    // existe e onde o MERCADOPAGO_WEBHOOK_SECRET valida a assinatura.
    expect(new URL(url).host).toBe(expected);
    expect(url).not.toContain(tenantSubdomain("autoprime"));
  });
});
