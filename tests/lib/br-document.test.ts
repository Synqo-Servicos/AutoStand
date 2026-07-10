import { describe, it, expect } from "vitest";
import {
  normalizeDocument, detectDocumentType, isValidDocument, formatDocument,
} from "@/lib/br-document";

describe("normalizeDocument", () => {
  it("mantém só dígitos", () => {
    expect(normalizeDocument("529.982.247-25")).toBe("52998224725");
    expect(normalizeDocument("11.222.333/0001-81")).toBe("11222333000181");
    expect(normalizeDocument("")).toBe("");
  });
});

describe("detectDocumentType", () => {
  it("11 dígitos = cpf, 14 = cnpj, resto = null", () => {
    expect(detectDocumentType("52998224725")).toBe("cpf");
    expect(detectDocumentType("11222333000181")).toBe("cnpj");
    expect(detectDocumentType("123")).toBeNull();
  });
});

describe("isValidDocument", () => {
  it("aceita CPF válido (com e sem máscara)", () => {
    expect(isValidDocument("529.982.247-25")).toBe(true);
    expect(isValidDocument("52998224725")).toBe(true);
  });
  it("aceita CNPJ válido (com e sem máscara)", () => {
    expect(isValidDocument("11.222.333/0001-81")).toBe(true);
    expect(isValidDocument("11222333000181")).toBe(true);
  });
  it("rejeita dígitos verificadores errados", () => {
    expect(isValidDocument("52998224724")).toBe(false);
    expect(isValidDocument("11222333000180")).toBe(false);
  });
  it("rejeita sequências repetidas e tamanhos inválidos", () => {
    expect(isValidDocument("11111111111")).toBe(false);
    expect(isValidDocument("00000000000000")).toBe(false);
    expect(isValidDocument("123")).toBe(false);
    expect(isValidDocument("")).toBe(false);
  });
});

describe("formatDocument", () => {
  it("mascara CPF progressivamente", () => {
    expect(formatDocument("529")).toBe("529");
    expect(formatDocument("52998224725")).toBe("529.982.247-25");
  });
  it("mascara CNPJ progressivamente", () => {
    expect(formatDocument("11222333000181")).toBe("11.222.333/0001-81");
  });
  it("trunca em 14 dígitos", () => {
    expect(formatDocument("112223330001812345")).toBe("11.222.333/0001-81");
  });
});
