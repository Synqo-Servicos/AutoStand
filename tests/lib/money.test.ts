import { describe, expect, it } from "vitest";
import {
  centsToDisplay, centsToDisplayFull, displayToCents, formatBRL, formatBRLFull,
} from "@/lib/money";

describe("centsToDisplayFull (round-trip fiel — usado nos inputs de valor de contas a pagar)", () => {
  it("preserva centavos ao converter de volta com displayToCents", () => {
    // 137,42 é o exemplo do achado original: virava "137" e gravava R$ 137,00.
    expect(centsToDisplayFull(13742)).toBe("137,42");
    expect(displayToCents(centsToDisplayFull(13742))).toBe(13742);

    expect(centsToDisplayFull(5)).toBe("0,05");
    expect(displayToCents(centsToDisplayFull(5))).toBe(5);

    // separador de milhar
    expect(centsToDisplayFull(450000)).toBe("4.500,00");
    expect(displayToCents(centsToDisplayFull(450000))).toBe(450000);

    expect(centsToDisplayFull(123456789)).toBe("1.234.567,89");
    expect(displayToCents(centsToDisplayFull(123456789))).toBe(123456789);
  });

  it("sempre mostra duas casas decimais, mesmo em valores redondos", () => {
    expect(centsToDisplayFull(100_00)).toBe("100,00");
    expect(centsToDisplayFull(0)).toBe("0,00");
  });
});

describe("centsToDisplay (arredonda pro inteiro — comportamento INTENCIONAL, não um bug)", () => {
  // Este teste documenta que a diferença entre centsToDisplay e
  // centsToDisplayFull é proposital: centsToDisplay serve veículos,
  // dashboard e financeiro, onde reais inteiros são a norma. Se alguém
  // "consertar" centsToDisplay pra preservar centavos no futuro, esses
  // domínios mudam de formato junto — e este teste quebra pra avisar.
  it("descarta os centavos em vez de preservá-los", () => {
    expect(centsToDisplay(13742)).toBe("137");
    expect(centsToDisplay(5)).toBe("0");
    expect(centsToDisplay(450000)).toBe("4.500");
  });

  it("não faz round-trip fiel com displayToCents quando há centavos", () => {
    expect(displayToCents(centsToDisplay(13742))).toBe(13700);
  });

  it("formatBRL herda o mesmo arredondamento — continua intocado", () => {
    expect(formatBRL(13742)).toBe("R$ 137");
  });
});

describe("formatBRLFull (usado nas telas de contas a pagar)", () => {
  it("mostra o valor completo com símbolo de moeda", () => {
    // toLocaleString com style:"currency" separa "R$" do valor com um
    // espaço NBSP (U+00A0), não um espaço comum.
    expect(formatBRLFull(13742)).toBe("R$ 137,42");
    expect(formatBRLFull(450000)).toBe("R$ 4.500,00");
  });
});

describe("displayToCents", () => {
  it("converte string em pt-BR (com separador de milhar e vírgula decimal) pra centavos", () => {
    expect(displayToCents("137,42")).toBe(13742);
    expect(displayToCents("4.500,00")).toBe(450000);
    expect(displayToCents("0,05")).toBe(5);
    expect(displayToCents("R$ 137,42")).toBe(13742);
  });

  it("entrada inválida devolve 0", () => {
    expect(displayToCents("")).toBe(0);
    expect(displayToCents("abc")).toBe(0);
    expect(displayToCents("—")).toBe(0);
  });
});
