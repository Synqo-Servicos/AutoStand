import { describe, it, expect, afterEach, vi } from "vitest";
import {
  competenciaAtual,
  competenciaDeInstante,
  instanteMs,
  isValidCompetencia,
  normalizeCompetencia,
  periodoDaCompetencia,
} from "@/lib/competencia";

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

/**
 * ============================================================================
 * A REGRA ÚNICA DE COMPETÊNCIA
 * ============================================================================
 *
 * `payments.paid_at` guarda o INSTANTE ABSOLUTO (`timestamptz`). A competência
 * de um pagamento é o mês desse instante convertido para `America/Sao_Paulo` —
 * e essa conversão acontece SÓ aqui. Todo o resto do módulo financeiro
 * (webhook, caixa, RBT12/DAS, fila fiscal, reconciliação) chama estas funções
 * em vez de fazer aritmética de fuso por conta própria.
 *
 * Os testes abaixo existem porque o bug que eles travam é invisível: ele só
 * aparece nas 3 h finais do último dia do mês, e o resultado é NFS-e emitida na
 * competência errada.
 */
describe("instanteMs — o offset é obrigatório e é honrado", () => {
  /** O mesmo instante, escrito de quatro jeitos diferentes. */
  const MESMO_INSTANTE = Date.UTC(2026, 8, 1, 1, 0, 0, 0); // 2026-09-01T01:00Z

  it("lê ISO-8601 com offset e converte para o instante absoluto", () => {
    expect(instanteMs("2026-08-31T22:00:00.000-03:00")).toBe(MESMO_INSTANTE);
  });

  it("lê o formato que o Postgres devolve para timestamptz (espaço e offset de 2 dígitos)", () => {
    // É literalmente o que volta do driver: `2026-09-01 01:00:00+00`.
    expect(instanteMs("2026-09-01 01:00:00+00")).toBe(MESMO_INSTANTE);
    expect(instanteMs("2026-08-31 22:00:00-03")).toBe(MESMO_INSTANTE);
  });

  it("lê `Z` como UTC", () => {
    expect(instanteMs("2026-09-01T01:00:00.000Z")).toBe(MESMO_INSTANTE);
  });

  it("as quatro grafias do mesmo instante são o MESMO número", () => {
    const grafias = [
      "2026-08-31T22:00:00.000-03:00",
      "2026-09-01 01:00:00+00",
      "2026-08-31 22:00:00-03",
      "2026-09-01T01:00:00.000Z",
    ].map(instanteMs);
    expect(new Set(grafias).size).toBe(1);
  });

  /**
   * A guarda que fecha o buraco do relatório: um carimbo SEM offset não tem
   * instante definido. Aceitá-lo "como UTC" ou "como São Paulo" seria escolher
   * em silêncio, e a escolha errada desloca a competência em 3 h — exatamente
   * a falha que não sinaliza nada porque os dois lados concordam.
   */
  it("REJEITA carimbo sem offset — em vez de escolher um fuso em silêncio", () => {
    expect(instanteMs("2026-08-31T22:00:00.000")).toBeNull();
    expect(instanteMs("2026-08-31 22:00:00")).toBeNull();
    expect(instanteMs("2026-08-31")).toBeNull();
  });

  it("rejeita data ilegível em vez de virar NaN silencioso", () => {
    expect(instanteMs("nem data é")).toBeNull();
    expect(instanteMs("2026-13-01T00:00:00.000Z")).toBeNull();
    expect(instanteMs("2026-08-15T99:00:00.000Z")).toBeNull();
    expect(instanteMs("")).toBeNull();
  });
});

describe("competenciaDeInstante — o mês é o de São Paulo, sempre", () => {
  it("as 22h de 31/08 em São Paulo são AGOSTO, não setembro", () => {
    // O instante é 01/09 01:00 UTC. Ler o mês em UTC daria "2026-09".
    expect(competenciaDeInstante("2026-09-01T01:00:00.000Z")).toBe("2026-08");
    expect(competenciaDeInstante("2026-08-31T22:00:00.000-03:00")).toBe("2026-08");
  });

  it("a virada de setembro em São Paulo é 03:00Z — a partir dali é setembro", () => {
    expect(competenciaDeInstante("2026-09-01T02:59:59.999Z")).toBe("2026-08");
    expect(competenciaDeInstante("2026-09-01T03:00:00.000Z")).toBe("2026-09");
  });

  it("atravessa a virada de ano pelo calendário de São Paulo", () => {
    expect(competenciaDeInstante("2027-01-01T02:00:00.000Z")).toBe("2026-12");
    expect(competenciaDeInstante("2027-01-01T03:00:00.000Z")).toBe("2027-01");
  });

  it("devolve null para o que não tem instante definido", () => {
    expect(competenciaDeInstante("2026-08-31 22:00:00")).toBeNull();
    expect(competenciaDeInstante("nem data é")).toBeNull();
  });

  it("o resultado é sempre uma competência válida", () => {
    expect(isValidCompetencia(competenciaDeInstante("2026-09-01T01:00:00Z")!)).toBe(true);
  });
});

describe("competenciaAtual — o mês corrente em São Paulo", () => {
  afterEach(() => { vi.useRealTimers(); });

  /**
   * Mata a mutação: derivar a competência de `new Date().toISOString()` (UTC).
   * Depois das 21h do dia 31 o console abriria no mês SEGUINTE — Caixa vazio,
   * RBT12 vazia, DAS 0.
   */
  it("às 22h de 31/08 em São Paulo o console ainda está em agosto", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T01:00:00.000Z"));
    expect(competenciaAtual()).toBe("2026-08");
    // A alternativa errada, explícita, para o teste dizer o que ele protege:
    expect(new Date().toISOString().slice(0, 7)).toBe("2026-09");
  });

  it("a partir das 00:00 de São Paulo vira o mês novo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T03:00:00.000Z"));
    expect(competenciaAtual()).toBe("2026-09");
  });

  it("não depende do fuso da máquina que roda o processo", () => {
    // O instante é o mesmo; o resultado tem que ser o mesmo em qualquer host.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T01:00:00.000Z"));
    expect(competenciaAtual()).toBe(competenciaDeInstante("2026-09-01T01:00:00.000Z"));
  });
});

describe("periodoDaCompetencia — limites absolutos ancorados em São Paulo", () => {
  it("o mês começa e termina à meia-noite de São Paulo, não de UTC", () => {
    const p = periodoDaCompetencia("2026-08");
    expect(p.from).toBe("2026-08-01T03:00:00.000Z");
    expect(p.to).toBe("2026-09-01T03:00:00.000Z");
  });

  it("atravessa a virada de ano", () => {
    const p = periodoDaCompetencia("2026-12");
    expect(p.from).toBe("2026-12-01T03:00:00.000Z");
    expect(p.to).toBe("2027-01-01T03:00:00.000Z");
  });

  it("o `to` de um mês é exatamente o `from` do seguinte — sem buraco, sem sobreposição", () => {
    expect(periodoDaCompetencia("2026-08").to).toBe(periodoDaCompetencia("2026-09").from);
    expect(periodoDaCompetencia("2026-12").to).toBe(periodoDaCompetencia("2027-01").from);
  });

  /**
   * A amarra entre os dois lados: o recorte [from, to) e `competenciaDeInstante`
   * têm que concordar em TODO instante. Se discordarem, existe uma segunda
   * opinião sobre em que mês a linha está — que é a doença que esta task cura.
   */
  it("concorda com competenciaDeInstante em todas as bordas", () => {
    for (const competencia of ["2026-08", "2026-12", "2027-02"]) {
      const { from, to } = periodoDaCompetencia(competencia);
      expect(competenciaDeInstante(from)).toBe(competencia);
      expect(competenciaDeInstante(new Date(instanteMs(to)! - 1).toISOString())).toBe(competencia);
      expect(competenciaDeInstante(to)).not.toBe(competencia);
    }
  });

  it("rejeita competência inválida em vez de calcular um período errado em silêncio", () => {
    expect(() => periodoDaCompetencia("2026-13")).toThrow(RangeError);
    expect(() => periodoDaCompetencia("abc")).toThrow(RangeError);
  });
});
