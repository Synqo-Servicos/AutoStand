import { describe, it, expect } from "vitest";
import { lastDayOfMonth, addMonthsClamped, daysBetween, defaultWindow } from "@/lib/recurring";

describe("lastDayOfMonth", () => {
  it("fevereiro comum tem 28", () => expect(lastDayOfMonth(2026, 2)).toBe(28));
  it("fevereiro bissexto tem 29", () => expect(lastDayOfMonth(2028, 2)).toBe(29));
  it("abril tem 30", () => expect(lastDayOfMonth(2026, 4)).toBe(30));
  it("dezembro tem 31", () => expect(lastDayOfMonth(2026, 12)).toBe(31));
});

describe("addMonthsClamped", () => {
  it("soma mês simples", () => expect(addMonthsClamped("2026-08-10", 1)).toBe("2026-09-10"));
  it("vira o ano", () => expect(addMonthsClamped("2026-12-10", 1)).toBe("2027-01-10"));
  it("clampa dia 31 em fevereiro", () => expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28"));
  it("clampa dia 31 em fevereiro bissexto", () => expect(addMonthsClamped("2028-01-31", 1)).toBe("2028-02-29"));
  it("clampa dia 31 em abril", () => expect(addMonthsClamped("2026-01-31", 3)).toBe("2026-04-30"));
  it("volta a 31 em maio — ancora no original, não no clampado", () => {
    expect(addMonthsClamped("2026-01-31", 4)).toBe("2026-05-31");
  });
  it("aceita deslocamento negativo", () => expect(addMonthsClamped("2026-08-10", -2)).toBe("2026-06-10"));
  it("soma 12 meses (anual)", () => expect(addMonthsClamped("2026-03-15", 12)).toBe("2027-03-15"));
});

describe("daysBetween", () => {
  it("conta dias à frente", () => expect(daysBetween("2026-08-10", "2026-08-13")).toBe(3));
  it("conta dias atrás como negativo", () => expect(daysBetween("2026-08-13", "2026-08-10")).toBe(-3));
  it("mesmo dia é zero", () => expect(daysBetween("2026-08-13", "2026-08-13")).toBe(0));
  it("atravessa virada de mês", () => expect(daysBetween("2026-08-30", "2026-09-02")).toBe(3));
  it("atravessa 29 de fevereiro", () => expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2));
});

describe("defaultWindow", () => {
  it("vai do 1º dia de 2 meses atrás ao último dia do mês seguinte", () => {
    expect(defaultWindow("2026-08-13")).toEqual({ from: "2026-06-01", to: "2026-09-30" });
  });
  it("atravessa a virada do ano", () => {
    expect(defaultWindow("2026-01-15")).toEqual({ from: "2025-11-01", to: "2026-02-28" });
  });
});

import { expandOccurrences, buildBills, stageForToday } from "@/lib/recurring";
import type { PayableRule, PaidRef } from "@/lib/recurring";

const WINDOW = { from: "2026-06-01", to: "2026-09-30" };

function rule(over: Partial<PayableRule> = {}): PayableRule {
  return {
    id: 1,
    frequency: "mensal",
    first_due_date: "2026-06-10",
    installments: null,
    payment_method: "boleto",
    amount_cents: 450_000,
    ...over,
  };
}

describe("expandOccurrences", () => {
  it("mensal gera uma ocorrência por mês dentro da janela", () => {
    expect(expandOccurrences(rule(), WINDOW).map((o) => o.due_date))
      .toEqual(["2026-06-10", "2026-07-10", "2026-08-10", "2026-09-10"]);
  });

  it("única gera exatamente uma", () => {
    const out = expandOccurrences(rule({ frequency: "unica", first_due_date: "2026-07-20" }), WINDOW);
    expect(out.map((o) => o.due_date)).toEqual(["2026-07-20"]);
  });

  it("anual gera no máximo uma dentro de uma janela de 4 meses", () => {
    const out = expandOccurrences(rule({ frequency: "anual", first_due_date: "2026-07-05" }), WINDOW);
    expect(out.map((o) => o.due_date)).toEqual(["2026-07-05"]);
  });

  it("installments corta a série e numera as parcelas", () => {
    const out = expandOccurrences(rule({ installments: 3 }), WINDOW);
    expect(out.map((o) => [o.due_date, o.installment, o.installments]))
      .toEqual([["2026-06-10", 1, 3], ["2026-07-10", 2, 3], ["2026-08-10", 3, 3]]);
  });

  it("installment é null quando a regra é indefinida", () => {
    expect(expandOccurrences(rule(), WINDOW)[0].installment).toBeNull();
  });

  it("ignora ocorrências anteriores à janela mas mantém a numeração", () => {
    const out = expandOccurrences(rule({ first_due_date: "2026-04-10", installments: 12 }), WINDOW);
    expect(out[0].due_date).toBe("2026-06-10");
    expect(out[0].installment).toBe(3);
  });

  it("devolve vazio quando o primeiro vencimento é posterior à janela", () => {
    expect(expandOccurrences(rule({ first_due_date: "2027-01-10" }), WINDOW)).toEqual([]);
  });

  it("preserva o clamp ao longo da série", () => {
    const out = expandOccurrences(rule({ first_due_date: "2026-01-31", installments: 12 }), WINDOW);
    expect(out.map((o) => o.due_date))
      .toEqual(["2026-06-30", "2026-07-31", "2026-08-31", "2026-09-30"]);
  });
});

describe("buildBills", () => {
  const TODAY = "2026-08-13";

  it("marca como pago quando existe transação casada", () => {
    const paid: PaidRef[] = [
      { payable_id: 1, due_date: "2026-08-10", transaction_id: 99, amount: 462_000 },
    ];
    const bills = buildBills([rule()], paid, WINDOW, TODAY);
    const ago = bills.find((b) => b.due_date === "2026-08-10")!;
    expect(ago.status).toBe("pago");
    expect(ago.transaction_id).toBe(99);
    expect(ago.paid_amount_cents).toBe(462_000);
  });

  it("classifica vencido e não pago como atrasado", () => {
    const bills = buildBills([rule()], [], WINDOW, TODAY);
    expect(bills.find((b) => b.due_date === "2026-07-10")!.status).toBe("atrasado");
  });

  it("classifica futuro como a_vencer", () => {
    const bills = buildBills([rule()], [], WINDOW, TODAY);
    expect(bills.find((b) => b.due_date === "2026-09-10")!.status).toBe("a_vencer");
  });

  it("classifica o dia exato como vence_hoje", () => {
    const bills = buildBills([rule({ first_due_date: "2026-08-13" })], [], WINDOW, TODAY);
    expect(bills.find((b) => b.due_date === "2026-08-13")!.status).toBe("vence_hoje");
  });

  it("débito automático vencido NÃO vira atrasado", () => {
    const bills = buildBills([rule({ payment_method: "debito_automatico" })], [], WINDOW, TODAY);
    expect(bills.find((b) => b.due_date === "2026-07-10")!.status).toBe("aguardando_conciliacao");
  });

  it("ordena por vencimento crescente", () => {
    const bills = buildBills([rule(), rule({ id: 2, first_due_date: "2026-06-05" })], [], WINDOW, TODAY);
    expect(bills.map((b) => b.due_date)).toEqual([...bills.map((b) => b.due_date)].sort());
  });
});

describe("stageForToday", () => {
  it("dispara d3 três dias antes", () => {
    expect(stageForToday("2026-08-16", "boleto", "2026-08-13")).toBe("d3");
  });
  it("não dispara em D-2", () => {
    expect(stageForToday("2026-08-15", "boleto", "2026-08-13")).toBeNull();
  });
  it("dispara d0 no vencimento", () => {
    expect(stageForToday("2026-08-13", "boleto", "2026-08-13")).toBe("d0");
  });
  it("dispara atraso-7 uma semana depois", () => {
    expect(stageForToday("2026-08-06", "boleto", "2026-08-13")).toBe("atraso-7");
  });
  it("dispara atraso-14 duas semanas depois", () => {
    expect(stageForToday("2026-07-30", "boleto", "2026-08-13")).toBe("atraso-14");
  });
  it("fica em silêncio nos dias intermediários do atraso", () => {
    expect(stageForToday("2026-08-05", "boleto", "2026-08-13")).toBeNull();
  });
  it("débito automático recebe d3 e mais nada", () => {
    expect(stageForToday("2026-08-16", "debito_automatico", "2026-08-13")).toBe("d3");
    expect(stageForToday("2026-08-13", "debito_automatico", "2026-08-13")).toBeNull();
    expect(stageForToday("2026-08-06", "debito_automatico", "2026-08-13")).toBeNull();
  });
});

