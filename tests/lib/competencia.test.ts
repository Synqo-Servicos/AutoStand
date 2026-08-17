import { describe, it, expect } from "vitest";
import { isValidCompetencia, normalizeCompetencia } from "@/lib/competencia";

describe("isValidCompetencia", () => {
  it("aceita YYYY-MM com mês entre 01 e 12", () => {
    expect(isValidCompetencia("2026-08")).toBe(true);
    expect(isValidCompetencia("2026-01")).toBe(true);
    expect(isValidCompetencia("2026-12")).toBe(true);
  });

  it("rejeita lixo — não numérico", () => {
    expect(isValidCompetencia("abc")).toBe(false);
  });

  it("rejeita mês fora de 01–12 — Date.UTC não valida isso sozinho", () => {
    expect(isValidCompetencia("2026-13")).toBe(false);
    expect(isValidCompetencia("2026-00")).toBe(false);
  });

  it("rejeita formato incompleto, com sufixo, ou vazio", () => {
    expect(isValidCompetencia("2026-8")).toBe(false);
    expect(isValidCompetencia("2026-08-15")).toBe(false);
    expect(isValidCompetencia("")).toBe(false);
  });
});

describe("normalizeCompetencia", () => {
  it("devolve o valor recebido quando ele é uma competência válida", () => {
    expect(normalizeCompetencia("2026-08", "2020-01")).toBe("2026-08");
  });

  it("cai no fallback com valor lixo — nunca propaga pra periodBounds/500", () => {
    expect(normalizeCompetencia("abc", "2020-01")).toBe("2020-01");
  });

  it("cai no fallback com mês fora de faixa — nunca num período errado em silêncio", () => {
    expect(normalizeCompetencia("2026-13", "2020-01")).toBe("2020-01");
  });

  it("cai no fallback quando o valor está ausente (searchParams sem `competencia`)", () => {
    expect(normalizeCompetencia(undefined, "2020-01")).toBe("2020-01");
  });
});
