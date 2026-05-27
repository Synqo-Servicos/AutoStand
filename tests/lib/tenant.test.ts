import { describe, expect, it } from "vitest";
import { isPlatformHost, isConsoleHost } from "@/lib/tenant";

// PLATFORM_HOSTS no ambiente de teste cai no fallback do tenant.ts:
// "localhost,127.0.0.1,app.localhost".

describe("isPlatformHost", () => {
  it("aceita os hosts do PLATFORM_HOSTS default", () => {
    expect(isPlatformHost("localhost")).toBe(true);
    expect(isPlatformHost("127.0.0.1")).toBe(true);
    expect(isPlatformHost("app.localhost")).toBe(true);
  });

  it("strip de porta funciona", () => {
    expect(isPlatformHost("localhost:3000")).toBe(true);
    expect(isPlatformHost("127.0.0.1:8080")).toBe(true);
  });

  it("case-insensitive", () => {
    expect(isPlatformHost("LocalHost")).toBe(true);
    expect(isPlatformHost("APP.localhost")).toBe(true);
  });

  it("rejeita hosts não-plataforma", () => {
    expect(isPlatformHost("autoprime.localhost")).toBe(false);
    expect(isPlatformHost("garagem082.com")).toBe(false);
    expect(isPlatformHost("")).toBe(false);
  });

  it("aceita console.<platform> mesmo sem estar no env", () => {
    // Helper reconhece o prefixo console. dinamicamente — não exige
    // listar console.localhost em PLATFORM_HOSTS.
    expect(isPlatformHost("console.localhost")).toBe(true);
    expect(isPlatformHost("console.127.0.0.1")).toBe(true);
  });

  it("console. com pai não-plataforma é rejeitado", () => {
    expect(isPlatformHost("console.example.com")).toBe(false);
    expect(isPlatformHost("console.autoprime.localhost")).toBe(false);
  });
});

describe("isConsoleHost", () => {
  it("aceita console.<platform>", () => {
    expect(isConsoleHost("console.localhost")).toBe(true);
    expect(isConsoleHost("console.localhost:3000")).toBe(true);
    expect(isConsoleHost("CONSOLE.LOCALHOST")).toBe(true);
  });

  it("rejeita plataforma sem prefixo console", () => {
    expect(isConsoleHost("localhost")).toBe(false);
    expect(isConsoleHost("app.localhost")).toBe(false);
    expect(isConsoleHost("127.0.0.1")).toBe(false);
  });

  it("rejeita console em host não-plataforma", () => {
    expect(isConsoleHost("console.example.com")).toBe(false);
    expect(isConsoleHost("console.autoprime.com")).toBe(false);
  });

  it("rejeita tenants (subdomínio comum)", () => {
    expect(isConsoleHost("autoprime.localhost")).toBe(false);
    expect(isConsoleHost("garagem082.localhost")).toBe(false);
  });

  it("rejeita strings vazias e malformadas", () => {
    expect(isConsoleHost("")).toBe(false);
    expect(isConsoleHost("console")).toBe(false);
    expect(isConsoleHost("console.")).toBe(false);
  });
});
