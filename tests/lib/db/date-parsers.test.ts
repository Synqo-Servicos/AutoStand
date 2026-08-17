import { describe, it, expect } from "vitest";
import { OID_TIMESTAMPTZ, registrarParsersDeData } from "@/lib/db/date-parsers";
import { instanteMs } from "@/lib/competencia";

/**
 * ============================================================================
 * A FRONTEIRA DO DRIVER — onde a competência quase escapou de novo
 * ============================================================================
 *
 * `payments.paid_at` é `timestamptz` e a coluna é declarada com
 * `mode: "string"`, então o drizzle entrega o valor como texto. QUEM produz
 * esse texto depende do parser de tipo do `pg`:
 *
 *  - com o parser PADRÃO, o `pg` devolve um `Date`, e aí o drizzle monta a
 *    string sozinho em `PgTimestampString.mapFromDriverValue`. Essa montagem
 *    escreve o relógio de UTC (`value.toISOString()`) e cola nele o offset da
 *    MÁQUINA (`value.getTimezoneOffset()`). Num host UTC (a Vercel) o offset é
 *    `+00` e a string sai certa por coincidência; em qualquer host que não seja
 *    UTC — a máquina de quem desenvolve, em Maceió — sai o relógio de UTC
 *    rotulado como `-03`, ou seja, um instante 3 h no futuro;
 *  - com um parser IDENTIDADE, o `pg` devolve o texto cru do Postgres
 *    (`2026-08-31 22:00:00-03`), o drizzle repassa sem tocar, e o offset que
 *    vem junto é o do dado, não o do host.
 *
 * O modo de falha do primeiro caminho é exatamente o que esta task existe para
 * matar: silencioso, de 3 h, e só visível na virada do mês. Por isso o parser
 * identidade é registrado explicitamente e travado por teste.
 */
describe("registrarParsersDeData", () => {
  function registrar() {
    const registrados = new Map<number, (val: string) => unknown>();
    registrarParsersDeData((oid, parser) => registrados.set(oid, parser));
    return registrados;
  }

  it("registra um parser para timestamptz (OID 1184)", () => {
    expect(registrar().has(OID_TIMESTAMPTZ)).toBe(true);
  });

  it("o parser é identidade — o texto do Postgres chega intacto", () => {
    const parser = registrar().get(OID_TIMESTAMPTZ)!;
    expect(parser("2026-08-31 22:00:00-03")).toBe("2026-08-31 22:00:00-03");
    expect(parser("2026-09-01 01:00:00+00")).toBe("2026-09-01 01:00:00+00");
  });

  /**
   * A propriedade que interessa de verdade: o que sai do driver é legível por
   * `instanteMs` e designa o instante certo — em qualquer host, porque o offset
   * viaja dentro do dado.
   */
  it("o texto entregue designa o instante correto, seja qual for o fuso do host", () => {
    const parser = registrar().get(OID_TIMESTAMPTZ)!;
    const instanteVerdadeiro = Date.UTC(2026, 8, 1, 1, 0, 0, 0); // 2026-09-01T01:00Z

    for (const cru of ["2026-08-31 22:00:00-03", "2026-09-01 01:00:00+00"]) {
      expect(instanteMs(parser(cru) as string)).toBe(instanteVerdadeiro);
    }
  });

  /**
   * O caminho alternativo, escrito por extenso para o teste dizer o que ele
   * impede: é a montagem do drizzle quando o `pg` devolve `Date`. Num host
   * `-03:00` ela produz um carimbo que aponta 3 h adiante do instante real.
   */
  it("a montagem do drizzle a partir de Date erraria 3h num host -03:00", () => {
    const instanteVerdadeiro = Date.UTC(2026, 8, 1, 1, 0, 0, 0);
    const comoDrizzleMontaria = (value: Date, offsetDoHostMin: number) => {
      const shortened = value.toISOString().slice(0, -1).replace("T", " ");
      const sinal = offsetDoHostMin <= 0 ? "+" : "-";
      const hh = String(Math.floor(Math.abs(offsetDoHostMin) / 60)).padStart(2, "0");
      return `${shortened}${sinal}${hh}`;
    };

    // Host em UTC: sai certo — é por isso que o bug não aparece na Vercel.
    const emUtc = comoDrizzleMontaria(new Date(instanteVerdadeiro), 0);
    expect(instanteMs(emUtc)).toBe(instanteVerdadeiro);

    // Host em -03:00 (getTimezoneOffset() === 180): sai 3 h adiantado.
    const emSaoPaulo = comoDrizzleMontaria(new Date(instanteVerdadeiro), 180);
    expect(instanteMs(emSaoPaulo)).toBe(instanteVerdadeiro + 3 * 60 * 60 * 1000);
    expect(instanteMs(emSaoPaulo)).not.toBe(instanteVerdadeiro);
  });
});
