import { describe, expect, it } from "vitest";
import {
  aliquotaEfetiva,
  dasEstimado,
  rbt12,
  LIMITE_SIMPLES_CENTS,
} from "@/lib/simples";
import { SIMPLES_TABELA, type SimplesAnexo } from "@/lib/simples-tabela";

/**
 * Estes testes cobrem a LÓGICA, não a tabela. A tabela vem de lei e muda por
 * decreto — repetir os números dela aqui só provaria que foram digitados
 * duas vezes. O que se testa é a fórmula que os consome, a escolha de faixa,
 * a proporcionalização de empresa nova, e as propriedades que a tabela tem
 * que ter (continuidade e monotonicidade), que é o que de fato pega um
 * dígito trocado.
 *
 * Unidades: dinheiro em centavos; `nominal` em centésimos de % (600 = 6,00%);
 * `efetiva` em fração decimal (0,086 = 8,60%).
 */

const ANEXOS: SimplesAnexo[] = ["III", "V"];

describe("aliquotaEfetiva — fórmula (RBT12 × Aliq − PD) / RBT12", () => {
  it("Anexo III com RBT12 de R$ 360.000,00 dá 8,60%", () => {
    // (360.000 × 11,20% − 9.360) / 360.000 = 30.960 / 360.000 = 0,086
    const r = aliquotaEfetiva(360_000_00, "III");
    expect(r.faixa).toBe(2);
    expect(r.efetiva).toBeCloseTo(0.086, 12);
  });

  it("Anexo V no mesmo RBT12 dá 16,75% — o anexo muda o imposto, não a fórmula", () => {
    // (360.000 × 18,00% − 4.500) / 360.000 = 60.300 / 360.000 = 0,1675
    const r = aliquotaEfetiva(360_000_00, "V");
    expect(r.faixa).toBe(2);
    expect(r.efetiva).toBeCloseTo(0.1675, 12);
  });

  it("Anexo V é mais caro que o III em toda faixa — é isso que o Fator R disputa", () => {
    for (const rbt of [50_000_00, 300_000_00, 900_000_00, 2_000_000_00]) {
      expect(aliquotaEfetiva(rbt, "V").efetiva).toBeGreaterThan(
        aliquotaEfetiva(rbt, "III").efetiva,
      );
    }
  });

  it("na 1ª faixa não há parcela a deduzir, então a efetiva é a própria nominal", () => {
    for (const anexo of ANEXOS) {
      const r = aliquotaEfetiva(100_000_00, anexo);
      expect(r.faixa).toBe(1);
      expect(r.deduzir).toBe(0);
      expect(r.efetiva).toBeCloseTo(r.nominal / 10_000, 12);
    }
  });

  it("RBT12 zero não divide por zero — a lei manda considerar R$ 1,00", () => {
    for (const anexo of ANEXOS) {
      const zerado = aliquotaEfetiva(0, anexo);
      expect(Number.isFinite(zerado.efetiva)).toBe(true);
      expect(zerado.faixa).toBe(1);
      expect(zerado).toEqual(aliquotaEfetiva(1_00, anexo));
    }
  });

  it("no teto do Simples ainda é a 6ª faixa; acima dele não estoura, mas o número deixa de valer", () => {
    // Passado o teto a empresa está fora do regime — quem exibe precisa
    // avisar. O módulo devolve a última faixa em vez de `undefined` para não
    // derrubar a página de quem chama.
    for (const anexo of ANEXOS) {
      expect(aliquotaEfetiva(LIMITE_SIMPLES_CENTS, anexo).faixa).toBe(6);
      const acima = aliquotaEfetiva(LIMITE_SIMPLES_CENTS + 1, anexo);
      expect(acima.faixa).toBe(6);
      expect(Number.isFinite(acima.efetiva)).toBe(true);
    }
  });

  it("recusa RBT12 negativa ou fracionada em vez de estimar em cima de lixo", () => {
    expect(() => aliquotaEfetiva(-1, "III")).toThrow(RangeError);
    expect(() => aliquotaEfetiva(100.5, "III")).toThrow(RangeError);
  });

  it("recusa anexo desconhecido — dado que atravessa fronteira de tipo não é confiável", () => {
    // O anexo pode chegar de config ou de banco, onde o tipo não vale nada.
    expect(() => aliquotaEfetiva(360_000_00, "IV" as SimplesAnexo)).toThrow(
      RangeError,
    );
  });
});

describe("aliquotaEfetiva — escolha de faixa", () => {
  it("o teto da faixa é inclusive: R$ 180.000,00 é 1ª faixa, R$ 180.000,01 é 2ª", () => {
    expect(aliquotaEfetiva(180_000_00, "III").faixa).toBe(1);
    expect(aliquotaEfetiva(180_000_01, "III").faixa).toBe(2);
  });

  it("a efetiva é contínua nas viradas da 1ª à 5ª faixa — sem degrau na virada", () => {
    // Esta é a checagem indireta da tabela: as parcelas a deduzir existem
    // justamente para colar o piso de cada faixa no teto da anterior. Um
    // dígito errado em qualquer `nominal` ou `deduzirCents` das faixas 1 a 5
    // quebra esta igualdade.
    for (const anexo of ANEXOS) {
      const tabela = SIMPLES_TABELA[anexo];
      for (let i = 0; i < 4; i++) {
        const teto = tabela[i].ateCents;
        const noTeto = aliquotaEfetiva(teto, anexo);
        const logoAcima = aliquotaEfetiva(teto + 1, anexo);
        expect(noTeto.faixa).toBe(i + 1);
        expect(logoAcima.faixa).toBe(i + 2);
        expect(logoAcima.efetiva).toBeCloseTo(noTeto.efetiva, 8);
      }
    }
  });

  it("da 5ª pra 6ª faixa a efetiva CAI — é o ISS saindo do DAS, não regressão", () => {
    // Documentado em lib/simples-tabela.ts: na 6ª faixa o ISS é recolhido à
    // parte, então a guia unificada encolhe enquanto o imposto total sobe.
    // Fixar isso em teste evita que alguém "conserte" a tabela achando que
    // é erro de digitação.
    for (const anexo of ANEXOS) {
      const naQuinta = aliquotaEfetiva(3_600_000_00, anexo);
      const naSexta = aliquotaEfetiva(3_600_000_01, anexo);
      expect(naQuinta.faixa).toBe(5);
      expect(naSexta.faixa).toBe(6);
      expect(naSexta.efetiva).toBeLessThan(naQuinta.efetiva);
    }
  });

  it("da 1ª à 5ª faixa a efetiva nunca cai quando a RBT12 sobe", () => {
    for (const anexo of ANEXOS) {
      let anterior = -1;
      for (let rbt = 1_00; rbt <= 3_600_000_00; rbt += 7_000_00) {
        const atual = aliquotaEfetiva(rbt, anexo).efetiva;
        expect(atual).toBeGreaterThanOrEqual(anterior - 1e-12);
        anterior = atual;
      }
    }
  });

  it("a efetiva nunca passa da nominal da faixa nem fica negativa", () => {
    for (const anexo of ANEXOS) {
      for (let rbt = 1_00; rbt <= 4_800_000_00; rbt += 13_000_00) {
        const r = aliquotaEfetiva(rbt, anexo);
        expect(r.efetiva).toBeGreaterThan(0);
        expect(r.efetiva).toBeLessThanOrEqual(r.nominal / 10_000);
      }
    }
  });
});

describe("rbt12 — empresa nova, proporcionalização", () => {
  it("1º mês de atividade: a receita do próprio mês vale por 12", () => {
    expect(rbt12([20_000_00], 1)).toBe(240_000_00);
  });

  it("do 2º ao 12º mês: média dos meses anteriores × 12", () => {
    const seisMeses = Array<number>(6).fill(30_000_00);
    expect(rbt12(seisMeses, 7)).toBe(360_000_00);
  });

  it("somar direto em vez de proporcionalizar joga a alíquota na faixa errada, PARA MENOS", () => {
    // A empresa nova é o caso que esta task existe para acertar.
    const seisMeses = Array<number>(6).fill(30_000_00);

    const somaDireta = seisMeses.reduce((a, b) => a + b, 0); // R$ 180.000,00
    const proporcional = rbt12(seisMeses, 7); // R$ 360.000,00
    expect(somaDireta).toBe(180_000_00);
    expect(proporcional).toBe(360_000_00);

    const errada = aliquotaEfetiva(somaDireta, "III");
    const certa = aliquotaEfetiva(proporcional, "III");

    // Somar direto para exatamente no teto da 1ª faixa; proporcionalizar
    // atravessa para a 2ª. Faixa diferente, alíquota diferente.
    expect(errada.faixa).toBe(1);
    expect(certa.faixa).toBe(2);
    expect(certa.efetiva).toBeGreaterThan(errada.efetiva);

    // E o que isso significa em dinheiro no mês: R$ 780,00 a menos separados.
    const dasErrado = dasEstimado(30_000_00, errada.efetiva);
    const dasCerto = dasEstimado(30_000_00, certa.efetiva);
    expect(dasErrado).toBe(1_800_00);
    expect(dasCerto).toBe(2_580_00);
    expect(dasCerto - dasErrado).toBe(780_00);
  });

  it("mês zerado entra na média e puxa a alíquota pra baixo — por isso precisa vir no array", () => {
    // Mesmos R$ 60.000,00 faturados; o que muda é quantos meses de atividade
    // já passaram. Omitir os meses zerados triplicaria a RBT12.
    expect(rbt12([0, 0, 60_000_00], 4)).toBe(240_000_00);
    expect(rbt12([60_000_00], 2)).toBe(720_000_00);
  });

  it("13º mês em diante: RBT12 de verdade, soma dos 12 meses anteriores", () => {
    const dozeMeses = Array<number>(12).fill(30_000_00);
    expect(rbt12(dozeMeses, 13)).toBe(360_000_00);
  });

  it("com mais de 12 meses no array, só os 12 últimos contam", () => {
    const historicoLongo = [900_000_00, 900_000_00, ...Array<number>(12).fill(30_000_00)];
    expect(rbt12(historicoLongo, 20)).toBe(360_000_00);
  });

  it("a virada do 12º pro 13º mês não dá salto quando a receita é constante", () => {
    const onzeMeses = Array<number>(11).fill(30_000_00);
    const dozeMeses = Array<number>(12).fill(30_000_00);
    expect(rbt12(onzeMeses, 12)).toBe(rbt12(dozeMeses, 13));
  });

  it("arredonda a média pra cima, para nunca cair numa faixa mais barata que a devida", () => {
    // Cinco meses de R$ 1.000,00 mais um centavo: 500.001 × 12 / 5 =
    // 1.200.002,4 centavos. Truncar devolveria 1.200.002 — um centavo a
    // menos de RBT12, que na virada de faixa é a diferença entre a alíquota
    // devida e a de baixo.
    const quaseRedondo = [1_000_00, 1_000_00, 1_000_00, 1_000_00, 1_000_01];
    expect(rbt12(quaseRedondo, 6)).toBe(1_200_003);

    // Quando a divisão fecha exata, não inventa centavo.
    expect(rbt12(Array<number>(5).fill(1_000_00), 6)).toBe(1_200_000);
  });
});

describe("rbt12 — contratos que estouram em vez de estimar errado", () => {
  it("rejeita mesesEmOperacao inválido", () => {
    expect(() => rbt12([10_000_00], 0)).toThrow(RangeError);
    expect(() => rbt12([10_000_00], -3)).toThrow(RangeError);
    expect(() => rbt12([10_000_00], 1.5)).toThrow(RangeError);
  });

  it("rejeita array com quantidade de meses incompatível com mesesEmOperacao", () => {
    // 7 meses de operação pedem os 6 anteriores; vieram 5.
    expect(() => rbt12(Array<number>(5).fill(30_000_00), 7)).toThrow(RangeError);
    // No 1º mês entra só o próprio mês.
    expect(() => rbt12([10_000_00, 10_000_00], 1)).toThrow(RangeError);
    // Do 13º em diante são necessários 12 meses cheios.
    expect(() => rbt12(Array<number>(11).fill(30_000_00), 13)).toThrow(RangeError);
  });

  it("rejeita receita negativa ou fracionada", () => {
    expect(() => rbt12([-1], 1)).toThrow(RangeError);
    expect(() => rbt12([10.5], 1)).toThrow(RangeError);
    expect(() => rbt12([Number.NaN], 1)).toThrow(RangeError);
  });
});

describe("dasEstimado", () => {
  it("aplica a alíquota efetiva sobre a receita DO MÊS", () => {
    expect(dasEstimado(10_000_00, 0.086)).toBe(860_00);
  });

  it("arredonda pro centavo mais próximo", () => {
    // 333.333 × 0,086 = 28.666,638 centavos
    expect(dasEstimado(3_333_33, 0.086)).toBe(28_667);
  });

  it("mês sem receita não gera DAS", () => {
    expect(dasEstimado(0, 0.086)).toBe(0);
  });

  it("recusa alíquota em centésimos de % — o erro de unidade mais provável", () => {
    // Passar `nominal` (860) no lugar de `efetiva` (0,086) daria um DAS 10.000x
    // maior; melhor estourar do que exibir.
    expect(() => dasEstimado(10_000_00, 860)).toThrow(RangeError);
    expect(() => dasEstimado(10_000_00, -0.1)).toThrow(RangeError);
    expect(() => dasEstimado(10.5, 0.086)).toThrow(RangeError);
  });
});

describe("fluxo completo — SYNQO em agosto/2026", () => {
  it("3º mês de atividade, dois meses zerados atrás, R$ 1.500,00 no mês", () => {
    // Aberta em 02/06/2026: junho é o mês 1, agosto é o mês 3. Junho e julho
    // sem receita; agosto com R$ 1.500,00 de assinaturas. Sem folha relevante
    // ainda, o Fator R fica abaixo de 28% e o anexo é o V.
    const acumulada = rbt12([0, 0], 3);
    expect(acumulada).toBe(0);

    const aliquota = aliquotaEfetiva(acumulada, "V");
    expect(aliquota.faixa).toBe(1);
    expect(aliquota.efetiva).toBeCloseTo(0.155, 12);

    // 15,50% de R$ 1.500,00 = R$ 232,50
    expect(dasEstimado(1_500_00, aliquota.efetiva)).toBe(232_50);
  });
});
