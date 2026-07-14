import { describe, it, expect } from "vitest";
import { getClientIp } from "@/lib/ratelimit";

/** Monta um request-like só com os headers — é tudo que getClientIp lê. */
function req(headers: Record<string, string>): { headers: Headers } {
  return { headers: new Headers(headers) };
}

describe("getClientIp", () => {
  it("usa x-real-ip quando presente (fonte confiável no Vercel)", () => {
    expect(getClientIp(req({ "x-real-ip": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("prefere x-real-ip mesmo com X-Forwarded-For presente", () => {
    // O cliente pode forjar o XFF; o x-real-ip é setado pela plataforma.
    const r = req({
      "x-real-ip": "203.0.113.7",
      "x-forwarded-for": "6.6.6.6, 1.1.1.1, 2.2.2.2",
    });
    expect(getClientIp(r)).toBe("203.0.113.7");
  });

  it("sem x-real-ip, usa o XFF quando ele tem uma única entrada", () => {
    expect(getClientIp(req({ "x-forwarded-for": "198.51.100.4" }))).toBe("198.51.100.4");
  });

  it("sem x-real-ip, usa a PRIMEIRA entrada do XFF (o cliente real), não a penúltima", () => {
    // A heurística antiga (penúltimo) devolveria "1.1.1.1" aqui — um valor que
    // o cliente controla ao mandar seu próprio XFF, permitindo furar o rate limit.
    const r = req({ "x-forwarded-for": "198.51.100.4, 1.1.1.1, 2.2.2.2" });
    expect(getClientIp(r)).toBe("198.51.100.4");
    expect(getClientIp(r)).not.toBe("1.1.1.1");
  });

  it("tolera espaços e entradas vazias no XFF", () => {
    expect(getClientIp(req({ "x-forwarded-for": "  198.51.100.4 ,, 2.2.2.2 " }))).toBe(
      "198.51.100.4",
    );
  });

  it("sem nenhum header de IP, devolve 'unknown'", () => {
    expect(getClientIp(req({}))).toBe("unknown");
  });

  it("com XFF vazio/só vírgulas e sem x-real-ip, devolve 'unknown'", () => {
    expect(getClientIp(req({ "x-forwarded-for": " , , " }))).toBe("unknown");
  });
});
