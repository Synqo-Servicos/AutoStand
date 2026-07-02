import { describe, it, expect } from "vitest";
import { waNumber, waHref } from "@/lib/whatsapp";

describe("waNumber", () => {
  it("mantém número já com DDI 55", () => {
    expect(waNumber("5582999999999")).toBe("5582999999999");
    expect(waNumber("5511988887777")).toBe("5511988887777");
  });

  it("adiciona 55 quando ausente (10-11 dígitos)", () => {
    expect(waNumber("82999999999")).toBe("5582999999999");
    expect(waNumber("1188887777")).toBe("551188887777");
  });

  it("remove formatação e normaliza", () => {
    expect(waNumber("(82) 99999-9999")).toBe("5582999999999");
    expect(waNumber("+55 82 99999-9999")).toBe("5582999999999");
  });
});

describe("waHref", () => {
  it("retorna null sem número", () => {
    expect(waHref(null)).toBeNull();
    expect(waHref(undefined)).toBeNull();
    expect(waHref("")).toBeNull();
  });

  it("monta a URL do wa.me normalizada", () => {
    expect(waHref("82999999999")).toBe("https://wa.me/5582999999999");
    expect(waHref("(82) 99999-9999")).toBe("https://wa.me/5582999999999");
  });

  it("inclui texto codificado quando fornecido", () => {
    expect(waHref("82999999999", "Olá!")).toBe(
      "https://wa.me/5582999999999?text=Ol%C3%A1!",
    );
  });
});
