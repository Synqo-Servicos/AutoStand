import { describe, it, expect, beforeEach } from "vitest";
import { signResetToken, verifyResetToken, passwordFingerprint } from "@/lib/reset-token";

beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret";
});

describe("reset-token", () => {
  it("assina e verifica (roundtrip) devolvendo userId + pf", () => {
    const pf = passwordFingerprint("hash123");
    const token = signResetToken(42, pf);
    expect(verifyResetToken(token)).toEqual({ userId: 42, pf });
  });

  it("rejeita token expirado", () => {
    const token = signResetToken(42, "pf", 1000);
    expect(verifyResetToken(token, 1000 + 3601)).toBeNull();
  });

  it("rejeita assinatura adulterada", () => {
    const token = signResetToken(42, "pf");
    const [data] = token.split(".");
    expect(verifyResetToken(`${data}.deadbeef`)).toBeNull();
  });

  it("rejeita formato inválido", () => {
    expect(verifyResetToken("naoehtoken")).toBeNull();
  });

  it("fingerprint muda quando a senha (hash) muda", () => {
    expect(passwordFingerprint("hashA")).not.toBe(passwordFingerprint("hashB"));
  });

  it("lança se AUTH_SECRET ausente", () => {
    delete process.env.AUTH_SECRET;
    expect(() => signResetToken(1, "pf")).toThrow();
  });
});
