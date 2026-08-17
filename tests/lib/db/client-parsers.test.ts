import { describe, it, expect, vi, beforeEach } from "vitest";
import { OID_TIMESTAMPTZ } from "@/lib/db/date-parsers";

/**
 * ============================================================================
 * A POLÍTICA DE PARSING PRECISA ESTAR INSTALADA, NÃO SÓ EXISTIR
 * ============================================================================
 *
 * `tests/lib/db/date-parsers.test.ts` prova que `registrarParsersDeData`
 * devolve o parser identidade certo. O que ele NÃO prova — e por isso este
 * arquivo existe — é que alguém chama essa função. Remover a linha
 * `registrarParsersDeData(...)` de `lib/db/client.ts` mantinha os 734 testes
 * verdes: o módulo continuava correto, apenas ninguém o usava.
 *
 * O modo de falha dessa remoção é o mais caro do módulo financeiro justamente
 * por ser invisível onde se olha. Sem o parser, o `pg` entrega `Date` e o
 * drizzle remonta a string escrevendo o relógio de UTC com o offset da
 * MÁQUINA. Na Vercel, que roda em UTC, o offset é `+00` e a string sai certa
 * por coincidência — produção fica verde. Em qualquer host que não seja UTC,
 * como o Mac de quem desenvolve em Maceió, sai o relógio de UTC rotulado
 * `-03`, designando um instante 3 h adiante do real. Basta isso para um
 * pagamento das 22h do dia 31 mudar de competência, e a NFS-e sair no mês
 * errado.
 *
 * `scripts/verificar-fuso.sh` também pega isso, mas contra um Postgres de
 * verdade e rodado à mão. Este teste é a rede que corre em toda suíte.
 *
 * O que ele cobre: que `lib/db/client.ts` registra, no `pg`, um parser para o
 * OID do `timestamptz`, e que o parser registrado devolve o texto cru.
 * O que ele NÃO cobre: que o Postgres de fato entregue esse texto com offset,
 * nem que o drizzle o repasse sem tocar — isso é fronteira de driver e exige
 * banco (é o passo 3 do `verificar-fuso.sh`).
 */

const mocks = vi.hoisted(() => ({
  setTypeParser: vi.fn(),
  poolOn: vi.fn(),
}));

vi.mock("pg", () => ({
  Pool: class {
    on = mocks.poolOn;
  },
  types: { setTypeParser: mocks.setTypeParser },
}));

vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: () => ({}) }));

vi.mock("@/lib/db/pool-config", () => ({ buildPoolConfig: () => ({}) }));

describe("lib/db/client — instalação dos parsers de tipo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("registra um parser para o OID do timestamptz", async () => {
    await import("@/lib/db/client");

    const registrado = mocks.setTypeParser.mock.calls.find(
      ([oid]) => oid === OID_TIMESTAMPTZ,
    );
    expect(registrado).toBeDefined();
    expect(typeof registrado![1]).toBe("function");
  });

  it("o parser registrado devolve o texto cru do Postgres, com o offset do DADO", async () => {
    await import("@/lib/db/client");

    const [, parser] = mocks.setTypeParser.mock.calls.find(
      ([oid]) => oid === OID_TIMESTAMPTZ,
    )!;
    // Forma que o Postgres entrega para `timestamptz`. Se algum dia isto virar
    // um `Date`, a competência volta a depender do fuso do processo.
    const cru = "2026-08-31 22:00:00-03";
    expect((parser as (v: string) => unknown)(cru)).toBe(cru);
  });
});
