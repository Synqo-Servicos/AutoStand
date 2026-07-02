import { describe, it, expect } from "vitest";
import {
  pickCreatableTenantFields,
  pickWritableTenantFields,
} from "@/lib/db/tenants";

// Invariante de segurança: o UPDATE (vindo de PATCH de usuário) NÃO pode
// setar campos de billing (defesa contra mass-assignment). Já a CRIAÇÃO
// (montada server-side no signup) precisa persistir o estado inicial de
// billing — que hoje era silenciosamente descartado.

const billing = {
  subscription_status: "incomplete",
  mp_subscription_id: "mp_123",
  current_period_end: "2026-12-31",
};

describe("allowlist de campos do tenant", () => {
  it("update: descarta campos de billing (mass-assignment)", () => {
    const out = pickWritableTenantFields({ name: "Loja", ...billing });
    expect(out).toEqual({ name: "Loja" });
    expect(out).not.toHaveProperty("subscription_status");
    expect(out).not.toHaveProperty("mp_subscription_id");
    expect(out).not.toHaveProperty("current_period_end");
  });

  it("create: mantém o estado inicial de billing", () => {
    const out = pickCreatableTenantFields({
      slug: "loja",
      name: "Loja",
      ...billing,
    });
    expect(out).toMatchObject({ slug: "loja", name: "Loja", ...billing });
  });

  it("ambos: ignoram chaves fora da allowlist", () => {
    expect(pickWritableTenantFields({ id: 999, name: "X" } as never)).toEqual({
      name: "X",
    });
    expect(
      pickCreatableTenantFields({ id: 999, slug: "s", name: "X" } as never),
    ).toEqual({ slug: "s", name: "X" });
  });
});
