import { describe, it, expect, beforeEach, vi } from "vitest";

describe("mp-checkout", () => {
  beforeEach(() => vi.resetModules());

  it("habilitado quando a public key existe", async () => {
    process.env.NEXT_PUBLIC_MP_PUBLIC_KEY = "TEST-abc";
    const { isMpCheckoutEnabled } = await import("@/lib/mp-checkout");
    expect(isMpCheckoutEnabled()).toBe(true);
  });

  it("desabilitado quando ausente", async () => {
    delete process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    const { isMpCheckoutEnabled } = await import("@/lib/mp-checkout");
    expect(isMpCheckoutEnabled()).toBe(false);
  });
});
