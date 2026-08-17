import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formatBRLFull } from "@/lib/money";
import { LIMITE_SIMPLES_CENTS, rbt12 } from "@/lib/simples";
import { ImpostoCard } from "@/components/superadmin/ImpostoCard";
import {
  SYNQO_ABERTURA,
  consultarBaseRbt12,
  mesesEmOperacao,
  planoRbt12,
  vencimentoDas,
  type SomarBrutoNoIntervalo,
} from "@/lib/finance-config";
import {
  competenciaDeInstante, instanteMs, periodoDaCompetencia,
} from "@/lib/competencia";

/**
 * `FINANCE_TAX_VALIDATED` e `FINANCE_ANEXO` são lidos no TOPO do módulo (uma
 * vez, na importação) — então trocar `process.env` depois não muda nada. Para
 * exercitar as duas posições da flag é preciso reimportar o módulo com o env
 * já trocado, que é o que `loadConfig` faz. Mesmo padrão de
 * `tests/lib/platform.test.ts`.
 */
async function loadConfig(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [chave, valor] of Object.entries(env)) {
    vi.stubEnv(chave, valor);
  }
  return import("@/lib/finance-config");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

// ============================================================================
// A regra da task: papel × flag
// ============================================================================

describe("showsTaxValue — os quatro cruzamentos de papel × flag", () => {
  it("super_admin com a flag DESLIGADA não vê valor", async () => {
    const { showsTaxValue, FINANCE_TAX_VALIDATED } = await loadConfig({
      FINANCE_TAX_VALIDATED: undefined,
    });
    expect(FINANCE_TAX_VALIDATED).toBe(false);
    expect(showsTaxValue("super_admin")).toBe(false);
  });

  it("super_admin com a flag LIGADA vê valor", async () => {
    const { showsTaxValue, FINANCE_TAX_VALIDATED } = await loadConfig({
      FINANCE_TAX_VALIDATED: "true",
    });
    expect(FINANCE_TAX_VALIDATED).toBe(true);
    expect(showsTaxValue("super_admin")).toBe(true);
  });

  it("contador com a flag DESLIGADA vê valor — é ele quem valida", async () => {
    const { showsTaxValue } = await loadConfig({
      FINANCE_TAX_VALIDATED: undefined,
    });
    expect(showsTaxValue("contador")).toBe(true);
  });

  it("contador com a flag LIGADA vê valor", async () => {
    const { showsTaxValue } = await loadConfig({
      FINANCE_TAX_VALIDATED: "true",
    });
    expect(showsTaxValue("contador")).toBe(true);
  });

  it("papel ausente/estranho segue a flag, nunca o contador", async () => {
    const off = await loadConfig({ FINANCE_TAX_VALIDATED: undefined });
    expect(off.showsTaxValue(undefined)).toBe(false);
    expect(off.showsTaxValue("tenant_admin")).toBe(false);
    expect(off.showsTaxValue("Contador")).toBe(false); // comparação é exata

    const on = await loadConfig({ FINANCE_TAX_VALIDATED: "1" });
    expect(on.showsTaxValue(undefined)).toBe(true);
  });
});

describe("FINANCE_TAX_VALIDATED — só allowlist liga", () => {
  it("aceita 'true' e '1', com espaço e maiúscula", async () => {
    for (const raw of ["true", "TRUE", " True ", "1", " 1 "]) {
      const { FINANCE_TAX_VALIDATED } = await loadConfig({
        FINANCE_TAX_VALIDATED: raw,
      });
      expect(FINANCE_TAX_VALIDATED, `raw=${JSON.stringify(raw)}`).toBe(true);
    }
  });

  it("qualquer outra coisa deixa DESLIGADO — o default falha escondendo", async () => {
    for (const raw of [undefined, "", "false", "0", "sim", "yes", "on", "  "]) {
      const { FINANCE_TAX_VALIDATED } = await loadConfig({
        FINANCE_TAX_VALIDATED: raw,
      });
      expect(FINANCE_TAX_VALIDATED, `raw=${JSON.stringify(raw)}`).toBe(false);
    }
  });
});

describe("FINANCE_ANEXO", () => {
  it("default é III", async () => {
    const { FINANCE_ANEXO } = await loadConfig({ FINANCE_ANEXO: undefined });
    expect(FINANCE_ANEXO).toBe("III");
  });

  it("aceita V (e normaliza caixa/espaço)", async () => {
    for (const raw of ["V", "v", " v "]) {
      const { FINANCE_ANEXO } = await loadConfig({ FINANCE_ANEXO: raw });
      expect(FINANCE_ANEXO, `raw=${JSON.stringify(raw)}`).toBe("V");
    }
  });

  it("valor irreconhecível cai no III (e a tela exibe o anexo para denunciar)", async () => {
    for (const raw of ["IV", "3", "anexo III", "X"]) {
      const { FINANCE_ANEXO } = await loadConfig({ FINANCE_ANEXO: raw });
      expect(FINANCE_ANEXO, `raw=${JSON.stringify(raw)}`).toBe("III");
    }
  });
});

// ============================================================================
// Calendário
// ============================================================================

describe("mesesEmOperacao", () => {
  it("o mês da abertura é o mês 1 (fração de mês conta inteiro)", () => {
    expect(SYNQO_ABERTURA).toBe("2026-06");
    expect(mesesEmOperacao("2026-06")).toBe(1);
  });

  it("conta o próprio mês de apuração", () => {
    expect(mesesEmOperacao("2026-07")).toBe(2);
    expect(mesesEmOperacao("2026-08")).toBe(3);
  });

  it("vira o ano sem se perder", () => {
    // jun/26 = 1 … dez/26 = 7, então jan/27 = 8. Um cálculo que só subtraísse
    // os MESES ("1 - 6 + 1") devolveria -4 aqui.
    expect(mesesEmOperacao("2027-01")).toBe(8);
    expect(mesesEmOperacao("2027-06")).toBe(13);
    expect(mesesEmOperacao("2027-07")).toBe(14);
  });

  it("devolve <= 0 antes da abertura — quem chama tem que tratar", () => {
    expect(mesesEmOperacao("2026-05")).toBe(0);
    expect(mesesEmOperacao("2025-08")).toBeLessThan(0);
  });

  it("competência fora do formato estoura em vez de calcular errado", () => {
    expect(() => mesesEmOperacao("2026-13")).toThrow(RangeError);
    expect(() => mesesEmOperacao("agosto")).toThrow(RangeError);
  });
});

describe("planoRbt12 — o array que rbt12 exige", () => {
  it("1º mês: nenhuma consulta, o array é o PRÓPRIO mês de apuração", () => {
    const plano = planoRbt12("2026-06", 1);
    expect(plano).toEqual({
      competencias: [],
      zerosAntes: 0,
      usaMesDeApuracao: true,
    });
  });

  it("do 2º mês em diante consulta só os ANTERIORES, nunca o de apuração", () => {
    const plano = planoRbt12("2026-08", 3);
    // Discrimina as três montagens erradas plausíveis:
    //   ["2026-07","2026-08"] → incluiria o mês de apuração;
    //   ["2026-05","2026-06"] → estaria um mês atrás;
    //   ["2026-06","2026-07","2026-08"] → comprimento errado, rbt12 estoura.
    expect(plano.competencias).toEqual(["2026-06", "2026-07"]);
    expect(plano.competencias).not.toContain("2026-08");
    expect(plano.usaMesDeApuracao).toBe(false);
    expect(plano.zerosAntes).toBe(0);
  });

  it("vira o ano na lista de meses", () => {
    // jan/2027 é o 8º mês: os 7 anteriores são jun/26 … dez/26.
    const plano = planoRbt12("2027-01", 8);
    expect(plano.competencias).toEqual([
      "2026-06", "2026-07", "2026-08", "2026-09",
      "2026-10", "2026-11", "2026-12",
    ]);
  });

  it("13º mês: 12 anteriores, sem zeros", () => {
    const plano = planoRbt12("2027-06", 13);
    expect(plano.competencias).toHaveLength(12);
    expect(plano.competencias[0]).toBe("2026-06");
    expect(plano.competencias[11]).toBe("2027-05");
    expect(plano.zerosAntes).toBe(0);
  });

  it("14º mês: consulta 12 e completa o comprimento com zeros", () => {
    const plano = planoRbt12("2027-07", 14);
    expect(plano.competencias).toHaveLength(12);
    expect(plano.competencias[0]).toBe("2026-07");
    expect(plano.competencias[11]).toBe("2027-06");
    expect(plano.zerosAntes).toBe(1);
    // O número de queries fica travado em 12 mesmo com a empresa envelhecendo.
    expect(planoRbt12("2036-07", 122).competencias).toHaveLength(12);
    expect(planoRbt12("2036-07", 122).zerosAntes).toBe(109);
  });

  it("meses inválidos estouram aqui, antes de chegar em rbt12", () => {
    expect(() => planoRbt12("2026-08", 0)).toThrow(RangeError);
    expect(() => planoRbt12("2026-08", -3)).toThrow(RangeError);
  });
});

describe("planoRbt12 × rbt12 — o contrato de comprimento fecha", () => {
  /** Monta o array exatamente como a página monta. */
  function montar(
    competencia: string,
    meses: number,
    receitaPorMes: (c: string) => number,
    receitaDoMesDeApuracao: number,
  ): number[] {
    const plano = planoRbt12(competencia, meses);
    if (plano.usaMesDeApuracao) return [receitaDoMesDeApuracao];
    return [
      ...new Array<number>(plano.zerosAntes).fill(0),
      ...plano.competencias.map(receitaPorMes),
    ];
  }

  it("não estoura em nenhum mês do 1º ao 24º", () => {
    for (let meses = 1; meses <= 24; meses++) {
      const competencia = `${2026 + Math.floor((5 + meses - 1) / 12)}-${String(
        ((5 + meses - 1) % 12) + 1,
      ).padStart(2, "0")}`;
      expect(mesesEmOperacao(competencia), competencia).toBe(meses);
      const arr = montar(competencia, meses, () => 1_000_00, 1_000_00);
      expect(() => rbt12(arr, meses), `meses=${meses}`).not.toThrow();
    }
  });

  it("mês zerado ENTRA no array com valor 0 (omitir inflaria a média)", () => {
    // 3 meses de operação, o do meio sem receita nenhuma.
    const receitas: Record<string, number> = {
      "2026-06": 3_000_00,
      "2026-07": 0,
    };
    const arr = montar("2026-08", 3, (c) => receitas[c], 0);
    expect(arr).toEqual([3_000_00, 0]);
    // Média (3000 + 0)/2 × 12 = 18.000,00. Se julho fosse OMITIDO, a média
    // viraria 3000 e a RBT12 dobraria para 36.000,00 — outra faixa possível
    // e um imposto errado. Os dois números divergem, é isso que o teste prova.
    expect(rbt12(arr, 3)).toBe(18_000_00);
    expect(rbt12([3_000_00], 2)).toBe(36_000_00);
  });

  it("os zeros de completude vão à ESQUERDA — à direita mudariam a soma", () => {
    // 14º mês: 13 elementos, dos quais rbt12 soma os 12 ÚLTIMOS.
    const doze = new Array<number>(12).fill(1_000_00);
    const esquerda = [0, ...doze];
    const direita = [...doze, 0];
    expect(esquerda).toHaveLength(13);
    expect(direita).toHaveLength(13);
    // Divergem: à esquerda o zero cai fora do slice(-12); à direita ele
    // expulsa um mês real de R$ 1.000,00 da janela que conta.
    expect(rbt12(esquerda, 14)).toBe(12_000_00);
    expect(rbt12(direita, 14)).toBe(11_000_00);
    expect(rbt12(esquerda, 14)).not.toBe(rbt12(direita, 14));

    // E é a montagem da esquerda que planoRbt12 produz.
    const arr = montar("2027-07", 14, () => 1_000_00, 999_999_99);
    expect(arr).toEqual(esquerda);
  });

  it("incluir o mês de apuração no array é rejeitado por rbt12", () => {
    // A montagem errada mais tentadora: "os meses de operação até agora".
    const errado = ["2026-06", "2026-07", "2026-08"].map(() => 1_000_00);
    expect(() => rbt12(errado, 3)).toThrow(RangeError);
  });
});

/**
 * ============================================================================
 * A JANELA DO RBT12 PARTICIONA A LINHA DO TEMPO
 * ============================================================================
 *
 * Aqui morava `mesBoundsInclusivos`, que existia só para encolher o `to` em
 * 1 ms e compensar o `lte` de `sumGrossBetween`. As duas convenções foram
 * unificadas em semiaberto e a função foi removida — ver o comentário no lugar
 * dela em lib/finance-config.ts.
 *
 * O que continua precisando de teste é a PROPRIEDADE que ela protegia: dentro
 * do array do RBT12, cada pagamento entra em exatamente um mês. Se entrasse em
 * dois, seria somado duas vezes na mesma apuração e a alíquota efetiva subiria
 * sozinha; se não entrasse em nenhum, a base do DAS ficaria a menor.
 *
 * A asserção NÃO reimplementa o predicado (foi assim que a mutação
 * `lte`→`lt` passou verde antes): ela cruza as duas implementações
 * independentes que precisam concordar — a aritmética de limites
 * (`periodoDaCompetencia`) e o classificador por fuso (`competenciaDeInstante`).
 */
describe("periodoDaCompetencia — a janela que alimenta o RBT12", () => {
  /** O recorte real: `>= from` e `< to`. Ver `dentroDoPeriodo` (lib/db/payments.ts). */
  function dentro(instante: string, janela: { from: string; to: string }): boolean {
    const t = instanteMs(instante)!;
    return t >= instanteMs(janela.from)! && t < instanteMs(janela.to)!;
  }

  const MESES = ["2026-06", "2026-07", "2026-08"];

  it("nenhum instante cai em dois meses nem em nenhum", () => {
    const janelas = MESES.map(periodoDaCompetencia);
    const instantes = [
      "2026-06-01T03:00:00.000Z", // 00:00 de 01/06 em São Paulo
      "2026-06-30T23:59:59.999Z",
      "2026-07-01T02:59:59.999Z", // 23:59:59.999 de 30/06 em São Paulo
      "2026-07-01T03:00:00.000Z", // 00:00 de 01/07 em São Paulo
      "2026-07-01T03:00:00.001Z",
      "2026-08-01T02:59:59.999Z",
      "2026-08-01T03:00:00.000Z",
      "2026-08-31T22:00:00.000-03:00", // a borda que quebrava tudo
    ];
    for (const t of instantes) {
      expect(janelas.filter((j) => dentro(t, j)).length, `instante ${t}`).toBe(1);
    }
  });

  /**
   * O cruzamento que importa: quem a janela aceita é exatamente quem o
   * classificador chama de daquele mês. Se as duas discordassem, existiria uma
   * segunda opinião sobre em que mês a linha está — e ela apareceria como
   * Caixa e fila fiscal mostrando meses diferentes para o mesmo pagamento.
   */
  it("a janela e o classificador de competência concordam instante a instante", () => {
    for (const competencia of MESES) {
      const janela = periodoDaCompetencia(competencia);
      for (const t of [
        "2026-06-01T03:00:00.000Z",
        "2026-07-01T02:59:59.999Z",
        "2026-07-01T03:00:00.000Z",
        "2026-08-31T22:00:00.000-03:00",
        "2026-09-01T01:00:00.000Z",
        "2026-09-01T03:00:00.000Z",
      ]) {
        expect(dentro(t, janela), `${t} em ${competencia}`)
          .toBe(competenciaDeInstante(t) === competencia);
      }
    }
  });

  it("as janelas de meses consecutivos são contíguas e não se sobrepõem", () => {
    for (const [a, b] of [
      ["2026-06", "2026-07"],
      ["2026-12", "2027-01"],
      ["2028-02", "2028-03"],
    ] as const) {
      // Contíguas por identidade: o fim de um É o começo do outro. Não há
      // "1 ms de folga" para acertar ou errar.
      expect(periodoDaCompetencia(a).to).toBe(periodoDaCompetencia(b).from);
    }
  });
});

describe("consultarBaseRbt12 — a guarda que impede a página de cair", () => {
  /** Banco de mentira que registra o que foi perguntado. */
  function fetcherFake(receitaPorMes: Record<string, number> = {}) {
    const chamadas: Array<{ from: string; to: string }> = [];
    const somar: SomarBrutoNoIntervalo = async ({ from, to }) => {
      chamadas.push({ from, to });
      // A chave é a competência do PRIMEIRO instante da janela — o mesmo
      // classificador que o resto do módulo usa, não um `slice(0, 7)` no ISO
      // (que devolveria o mês de UTC e erraria a janela de São Paulo).
      return receitaPorMes[competenciaDeInstante(from)!] ?? 0;
    };
    return { chamadas, somar };
  }

  it("competência ANTERIOR à abertura devolve null em vez de estourar", async () => {
    const { chamadas, somar } = fetcherFake();
    // Sem a guarda, `mesesEmOperacao("2026-03") === 0` desce para `planoRbt12`
    // /`rbt12`, que estouram `RangeError` — e um `RangeError` num Server
    // Component derruba a página INTEIRA, com a flag ligada ou desligada. É o
    // caminho mais fácil de quebrar a tela: basta digitar um mês no picker.
    await expect(consultarBaseRbt12("2026-03", somar)).resolves.toBeNull();
    await expect(consultarBaseRbt12("2025-08", somar)).resolves.toBeNull();
    // E nem chega a consultar o banco por um mês em que a empresa não existia.
    expect(chamadas).toEqual([]);
  });

  it("o mês da abertura já passa pela guarda (meses === 1, não 0)", async () => {
    const { chamadas, somar } = fetcherFake();
    const base = await consultarBaseRbt12(SYNQO_ABERTURA, somar);
    expect(base?.meses).toBe(1);
    // 1º mês usa o PRÓPRIO mês de apuração, que a página já tem em mãos.
    expect(base?.plano.usaMesDeApuracao).toBe(true);
    expect(chamadas).toEqual([]);
  });

  it("consulta um mês por competência do plano, com a janela de São Paulo", async () => {
    const { chamadas, somar } = fetcherFake({
      "2026-06": 3_000_00,
      "2026-07": 1_000_00,
    });
    const base = await consultarBaseRbt12("2026-08", somar);
    expect(base?.meses).toBe(3);
    expect(base?.plano.competencias).toEqual(["2026-06", "2026-07"]);
    // Na MESMA ordem do plano — trocar a ordem trocaria as receitas de mês.
    expect(base?.brutoPorMes).toEqual([3_000_00, 1_000_00]);
    // Janelas semiabertas ancoradas na meia-noite de São Paulo (03:00Z), e
    // contíguas: o `to` de junho é o `from` de julho. Com limites de UTC
    // (00:00Z) as 21h–24h do último dia de cada mês entrariam no mês errado.
    expect(chamadas).toEqual([
      { from: "2026-06-01T03:00:00.000Z", to: "2026-07-01T03:00:00.000Z" },
      { from: "2026-07-01T03:00:00.000Z", to: "2026-08-01T03:00:00.000Z" },
    ]);
  });

  it("mês sem pagamento nenhum entra com 0, não some do array", async () => {
    const { somar } = fetcherFake({ "2026-06": 3_000_00 });
    const base = await consultarBaseRbt12("2026-08", somar);
    expect(base?.brutoPorMes).toEqual([3_000_00, 0]);
  });
});

describe("vencimentoDas", () => {
  it("é o dia 20 do mês subsequente", () => {
    expect(vencimentoDas("2026-08")).toBe("2026-09-20");
    expect(vencimentoDas("2026-06")).toBe("2026-07-20");
  });

  it("vira o ano", () => {
    expect(vencimentoDas("2026-12")).toBe("2027-01-20");
  });
});

// ============================================================================
// montarImposto + ImpostoCard — os quatro cruzamentos até o HTML
// ============================================================================

/**
 * Não há navegador nesta sessão, então a verificação de que o valor some (e de
 * que aparece com a palavra "estimado") é feita no HTML renderizado pelo
 * componente, que é o que o navegador receberia. `renderToStaticMarkup` basta
 * porque `ImpostoCard` é Server Component puro: sem estado, sem efeito.
 */
type ConfigModule = Awaited<ReturnType<typeof loadConfig>>;

/**
 * Chama o `consultarBaseRbt12` DE VERDADE — o mesmo que a página chama —
 * trocando só o banco por um dicionário. Nada aqui reimplementa a guarda de
 * competência anterior à abertura nem a montagem do plano: reimplementar
 * testaria uma cópia, e a guarda é justamente o caminho que derruba a página.
 *
 * O fetcher recebe os limites reais de `periodoDaCompetencia`, e o mês é lido
 * de volta pelo MESMO classificador que o resto do módulo usa — se um dia o
 * `from` deixar de ser o primeiro instante do mês em São Paulo, estes cenários
 * param de achar receita e o teste denuncia.
 */
function baseFake(
  mod: ConfigModule,
  competencia: string,
  receitaPorMes: Record<string, number>,
) {
  return mod.consultarBaseRbt12(competencia, async ({ from }) => {
    return receitaPorMes[competenciaDeInstante(from)!] ?? 0;
  });
}

/**
 * Cenário fixo, escolhido para bater com o exemplo da docstring de
 * `lib/simples.ts` e ser conferível na mão:
 *   jun/26 = jul/26 = R$ 30.000,00  →  RBT12 = (60.000 / 2) × 12 = R$ 360.000,00
 *   Anexo III, faixa 2 (teto R$ 360.000,00)  →  alíquota efetiva 8,60%
 *   receita de ago/26 = R$ 30.000,00  →  DAS = R$ 2.580,00
 */
const RECEITAS = { "2026-06": 30_000_00, "2026-07": 30_000_00 };
const RECEITA_AGOSTO = 30_000_00;
const RBT12_ESPERADO = 360_000_00;
const DAS_ESPERADO = 2_580_00;

/**
 * O MESMO cenário lido pelo Anexo V, que é o que a SYNQO vira se o Fator R
 * cair abaixo de 28%: faixa 2, nominal 18,00%, parcela a deduzir R$ 4.500,00
 *   →  efetiva = (360.000 × 18% − 4.500) / 360.000 = 16,75%
 *   →  DAS de R$ 30.000,00 = R$ 5.025,00
 * Nenhum desses números existe no Anexo III — é o que faz o teste distinguir
 * os dois anexos em vez de só conferir o rótulo da tela.
 */
const EFETIVA_V = 0.1675;
const DAS_V_ESPERADO = 5_025_00;

async function renderizar(
  role: string | undefined,
  flag: string | undefined,
  anexo?: string,
) {
  const mod = await loadConfig({
    FINANCE_TAX_VALIDATED: flag,
    FINANCE_ANEXO: anexo,
  });
  const props = mod.montarImposto({
    competencia: "2026-08",
    receitaMesCents: RECEITA_AGOSTO,
    role,
    base: await baseFake(mod, "2026-08", RECEITAS),
  });
  return { props, html: renderToStaticMarkup(createElement(ImpostoCard, props)) };
}

describe("montarImposto × ImpostoCard — papel × flag no HTML", () => {
  it("super_admin + flag OFF: insumos sim, valor não", async () => {
    const { props, html } = await renderizar("super_admin", undefined);

    expect(props.valores).toBeNull();
    expect(props.rbt12Cents).toBe(RBT12_ESPERADO);

    // O estado e os insumos aparecem…
    expect(html).toContain("Aguardando validação contábil");
    expect(html).toContain(formatBRLFull(RBT12_ESPERADO)); // RBT12 apurado
    expect(html).toContain("Anexo III"); // anexo configurado
    expect(html).toContain("06/2026"); // desde quando
    expect(html).toContain("3º mês");
    expect(html).toContain("06/2026 a 07/2026"); // janela da receita usada

    // …e o valor, não.
    expect(html).not.toContain("DAS estimado");
    expect(html).not.toContain(formatBRLFull(DAS_ESPERADO));
    expect(html).not.toContain("8,60");
    expect(html).not.toContain("%"); // nenhuma alíquota, em nenhuma forma
  });

  it("super_admin + flag ON: vê tudo, marcado como validado", async () => {
    const { props, html } = await renderizar("super_admin", "true");

    expect(props.valores).not.toBeNull();
    expect(props.valores?.dasCents).toBe(DAS_ESPERADO);
    expect(props.valores?.faixa).toBe(2);

    expect(html).toContain("DAS estimado");
    expect(html).toContain(formatBRLFull(DAS_ESPERADO));
    expect(html).toContain("8,60%");
    expect(html).toContain("20/09/2026"); // vencimento
    expect(html).toContain("estimado"); // a ressalva obrigatória
    expect(html).toContain("Validado pela contabilidade");
    expect(html).not.toContain("não validado");
  });

  it("contador + flag OFF: vê tudo, marcado como NÃO validado", async () => {
    const { props, html } = await renderizar("contador", undefined);

    expect(props.validado).toBe(false);
    expect(props.valores?.dasCents).toBe(DAS_ESPERADO);

    expect(html).toContain("DAS estimado");
    expect(html).toContain(formatBRLFull(DAS_ESPERADO));
    expect(html).toContain("8,60%");
    expect(html).toContain("estimado");
    expect(html).toContain("Cálculo não validado");
    expect(html).not.toContain("Aguardando validação contábil");
  });

  it("contador + flag ON: vê tudo, sem aviso de pendência", async () => {
    const { props, html } = await renderizar("contador", "1");

    expect(props.validado).toBe(true);
    expect(props.valores?.dasCents).toBe(DAS_ESPERADO);

    expect(html).toContain(formatBRLFull(DAS_ESPERADO));
    expect(html).toContain("estimado");
    expect(html).toContain("Validado pela contabilidade");
    expect(html).not.toContain("não validado");
  });

  it("os dois estados exibem exatamente os mesmos insumos", async () => {
    const escondido = await renderizar("super_admin", undefined);
    const visivel = await renderizar("contador", undefined);
    for (const insumo of [
      formatBRLFull(RBT12_ESPERADO),
      "Anexo III",
      "06/2026",
      "3º mês",
    ]) {
      expect(escondido.html, insumo).toContain(insumo);
      expect(visivel.html, insumo).toContain(insumo);
    }
  });
});

describe("FINANCE_ANEXO chega na CONTA, não só no rótulo da tela", () => {
  it("com FINANCE_ANEXO=V a alíquota e o DAS são os do Anexo V", async () => {
    const { props, html } = await renderizar("contador", "true", "V");

    expect(props.anexo).toBe("V");
    // A RBT12 não depende do anexo: é a MESMA do cenário de cima. O que muda
    // daqui para baixo é só o que o anexo determina.
    expect(props.rbt12Cents).toBe(RBT12_ESPERADO);
    expect(props.valores?.faixa).toBe(2);
    expect(props.valores?.efetiva).toBeCloseTo(EFETIVA_V, 12);
    expect(props.valores?.dasCents).toBe(DAS_V_ESPERADO);

    expect(html).toContain("Anexo V");
    expect(html).toContain("Alíquota efetiva (faixa 2)");
    expect(html).toContain("16,75%");
    expect(html).toContain(formatBRLFull(DAS_V_ESPERADO)); // R$ 5.025,00

    // E NENHUM número do Anexo III sobra. É esta metade que denuncia a tela
    // exibindo "Anexo V" enquanto a conta sai pelo III — o modo de falha que
    // custaria 8,15 pontos percentuais de alíquota em silêncio.
    expect(html).not.toContain("Anexo III");
    expect(html).not.toContain("8,60%");
    expect(html).not.toContain(formatBRLFull(DAS_ESPERADO)); // R$ 2.580,00
  });

  it("o mesmo cenário no Anexo III dá outro imposto — os dois divergem", async () => {
    const iii = await renderizar("contador", "true", undefined);
    const v = await renderizar("contador", "true", "V");

    expect(iii.props.rbt12Cents).toBe(v.props.rbt12Cents);
    expect(iii.props.valores?.faixa).toBe(v.props.valores?.faixa);
    // Mesma RBT12, mesma faixa, imposto quase o DOBRO: R$ 2.580,00 × R$ 5.025,00.
    expect(iii.props.valores?.dasCents).toBe(DAS_ESPERADO);
    expect(v.props.valores?.dasCents).toBe(DAS_V_ESPERADO);
    expect(iii.props.valores?.efetiva).not.toBe(v.props.valores?.efetiva);
  });
});

describe("ImpostoCard — o rótulo diz sob QUAL regra a RBT12 foi feita", () => {
  /** Renderiza a competência inteira, do plano ao HTML. */
  async function renderMes(mod: ConfigModule, competencia: string) {
    const meses = mod.mesesEmOperacao(competencia);
    const plano = mod.planoRbt12(competencia, meses);
    const props = mod.montarImposto({
      competencia,
      receitaMesCents: 10_000_00,
      role: "contador",
      base: await baseFake(
        mod,
        competencia,
        Object.fromEntries(plano.competencias.map((c) => [c, 10_000_00])),
      ),
    });
    return { meses, html: renderToStaticMarkup(createElement(ImpostoCard, props)) };
  }

  it("até o 12º mês a RBT12 é ANUALIZADA (§ 3º: média × 12)", async () => {
    const mod = await loadConfig({ FINANCE_TAX_VALIDATED: "true" });
    const { meses, html } = await renderMes(mod, "2027-05");
    expect(meses).toBe(12); // último mês do regime anualizado
    expect(html).toContain("RBT12 anualizada");
    expect(html).not.toContain("acumulada");
  });

  it("do 13º mês em diante é ACUMULADA (§ 1º: soma real dos 12 anteriores)", async () => {
    const mod = await loadConfig({ FINANCE_TAX_VALIDATED: "true" });
    const { meses, html } = await renderMes(mod, "2027-06");
    expect(meses).toBe(13); // primeiro mês do regime acumulado
    expect(html).toContain("RBT12 acumulada");
    expect(html).not.toContain("anualizada");
    // O rótulo é o que diz ao contador sob qual interpretação conferir o
    // número; fixo, ele validaria a conta certa pela regra errada.
  });
});

describe("ImpostoCard — bordas que não podem virar tela quebrada", () => {
  it("competência anterior à abertura não estoura e não mostra zero", async () => {
    const mod = await loadConfig({ FINANCE_TAX_VALIDATED: "true" });
    const props = mod.montarImposto({
      competencia: "2026-03",
      receitaMesCents: 0,
      role: "contador",
      base: await baseFake(mod, "2026-03", {}),
    });
    expect(props.meses).toBeLessThan(1);
    expect(props.rbt12Cents).toBeNull();
    expect(props.valores).toBeNull();

    const html = renderToStaticMarkup(createElement(ImpostoCard, props));
    expect(html).toContain("Fora do período de operação");
    expect(html).toContain("A empresa abriu em 06/2026");
    expect(html).not.toContain("R$"); // nada de zero disfarçado de apuração
  });

  it("1º mês de operação usa o PRÓPRIO mês e não consulta nada", async () => {
    const mod = await loadConfig({ FINANCE_TAX_VALIDATED: "true" });
    const base = await baseFake(mod, "2026-06", {});
    expect(base?.plano.usaMesDeApuracao).toBe(true);
    expect(base?.plano.competencias).toEqual([]);

    const props = mod.montarImposto({
      competencia: "2026-06",
      receitaMesCents: 10_000_00,
      role: "super_admin",
      base,
    });
    // § 2º: receita do próprio mês × 12.
    expect(props.rbt12Cents).toBe(120_000_00);
    expect(props.janela).toEqual({ de: "2026-06", ate: "2026-06" });

    const html = renderToStaticMarkup(createElement(ImpostoCard, props));
    expect(html).toContain("1º mês");
    expect(html).toContain(formatBRLFull(120_000_00));
  });

  it("14º mês: o zero de completude não rouba mês real da soma", async () => {
    const mod = await loadConfig({ FINANCE_TAX_VALIDATED: "true" });
    const competencia = "2027-07"; // 14º mês desde jun/2026
    const plano = mod.planoRbt12(competencia, 14);
    expect(plano.zerosAntes).toBe(1);
    const props = mod.montarImposto({
      competencia,
      receitaMesCents: 1_000_00,
      role: "contador",
      base: await baseFake(
        mod,
        competencia,
        Object.fromEntries(plano.competencias.map((c) => [c, 1_000_00])),
      ),
    });
    // Do 13º mês em diante a RBT12 é a soma REAL dos 12 meses anteriores:
    // 12 × R$ 1.000,00 = R$ 12.000,00. Se o zero de completude entrasse à
    // DIREITA, ele expulsaria um mês real do `slice(-12)` e o número cairia
    // para R$ 11.000,00 — as duas montagens divergem, é isso que se afirma.
    expect(props.rbt12Cents).toBe(12_000_00);
    expect(props.rbt12Cents).not.toBe(11_000_00);
  });

  it("empresa sem receita nenhuma renderiza sem estourar (RBT12 zero)", async () => {
    const mod = await loadConfig({ FINANCE_TAX_VALIDATED: "true" });
    const props = mod.montarImposto({
      competencia: "2026-08",
      receitaMesCents: 0,
      role: "contador",
      base: await baseFake(mod, "2026-08", {}),
    });
    expect(props.rbt12Cents).toBe(0);
    // Parágrafo único do art. 21: RBT12 zero vira R$ 1,00 só para achar a
    // faixa — a alíquota sai da 1ª faixa e o DAS de receita zero é zero.
    expect(props.valores?.faixa).toBe(1);
    expect(props.valores?.dasCents).toBe(0);
    expect(() =>
      renderToStaticMarkup(createElement(ImpostoCard, props)),
    ).not.toThrow();
  });

  it("RBT12 acima do teto do Simples avisa na tela", async () => {
    const mod = await loadConfig({ FINANCE_TAX_VALIDATED: "true" });
    // 2 meses de R$ 500.000,00 → média × 12 = R$ 6.000.000,00, acima do teto
    // de R$ 4.800.000,00: a empresa está fora do regime e a estimativa deixa
    // de valer. `lib/simples-tabela.ts` pede explicitamente que quem exibe o
    // número avise em vez de só mostrar.
    const props = mod.montarImposto({
      competencia: "2026-08",
      receitaMesCents: 500_000_00,
      role: "contador",
      base: await baseFake(mod, "2026-08", {
        "2026-06": 500_000_00,
        "2026-07": 500_000_00,
      }),
    });
    expect(props.rbt12Cents).toBeGreaterThan(LIMITE_SIMPLES_CENTS);

    const html = renderToStaticMarkup(createElement(ImpostoCard, props));
    expect(html).toContain("RBT12 acima do teto do Simples");
    expect(html).toContain(formatBRLFull(LIMITE_SIMPLES_CENTS));
  });

  it("abaixo do teto o aviso NÃO aparece — senão ele viraria ruído", async () => {
    const { props, html } = await renderizar("contador", "true");
    expect(props.rbt12Cents).toBeLessThan(LIMITE_SIMPLES_CENTS);
    expect(html).not.toContain("acima do teto do Simples");
  });

  it("nenhum mês do 1º ao 24º derruba a montagem, com a flag nas duas posições", async () => {
    for (const flag of [undefined, "true"]) {
      const mod = await loadConfig({ FINANCE_TAX_VALIDATED: flag });
      for (let meses = 1; meses <= 24; meses++) {
        const idx = 5 + meses - 1; // jun/2026 = índice 5 do ano de 2026
        const competencia = `${2026 + Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
        const props = mod.montarImposto({
          competencia,
          receitaMesCents: 20_000_00,
          role: "super_admin",
          base: await baseFake(
            mod,
            competencia,
            Object.fromEntries(
              mod
                .planoRbt12(competencia, meses)
                .competencias.map((c) => [c, 20_000_00]),
            ),
          ),
        });
        expect(props.rbt12Cents, `${competencia} (mês ${meses})`).toBeGreaterThan(0);
        expect(() =>
          renderToStaticMarkup(createElement(ImpostoCard, props)),
        ).not.toThrow();
      }
    }
  });
});
