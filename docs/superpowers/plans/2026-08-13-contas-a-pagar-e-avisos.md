# Contas a pagar e avisos de vencimento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o lojista cadastre contas (recorrentes ou avulsas), veja o que vence e o que está atrasado no painel, receba aviso por e-mail antes do vencimento, e registre o pagamento — que vira transação no financeiro existente.

**Architecture:** Uma tabela `payables` guarda a **regra**; as ocorrências ("o aluguel de agosto") são **derivadas**, nunca persistidas — mesmo idioma de `listPendingSales` (`lib/db/vehicles.ts:55`). Toda a matemática de recorrência e classificação vive num módulo puro (`lib/recurring.ts`) testado sem banco; `lib/db/payables.ts` só busca linhas e delega. Pagar cria uma transação normal (`despesa_fixa`/`despesa_var`) com `payable_id` + `due_date`, e a pendência some sozinha por `NOT EXISTS`.

**Tech Stack:** Next.js App Router · Drizzle ORM + Postgres (Neon) · Zod · Vitest · Tailwind + kit `components/ui` · Vercel Cron · SMTP via `lib/email`

**Spec:** `docs/superpowers/specs/2026-08-13-contas-a-pagar-e-avisos-design.md`

## Global Constraints

- **Toda função tenant-scoped recebe `tenantId: number` como primeiro argumento** e filtra todas as queries por ele (convenção declarada em `lib/db/index.ts`).
- **Datas são strings `YYYY-MM-DD`**, comparadas lexicograficamente. Nunca usar `new Date()` para "hoje" dentro de lógica de negócio — a data de referência é sempre um parâmetro injetado.
- **Valores monetários são inteiros em centavos** (`amount`, `amount_cents`).
- **Nenhum gating por plano.** A feature vale para Básico, Pro e Premium.
- **`payables` não é deletável** — apenas `active = false`.
- Testes rodam em Node puro (`vitest.config.ts`): funções puras diretas, rotas com `vi.mock("@/lib/db")` e `vi.mock("@/lib/api")` no padrão de `tests/api/transactions-pendentes.test.ts`.
- Migrations: `npm run db:generate` gera o SQL em `drizzle/`; aplicar no Neon via `migrate.yml` **antes** de mergear na `main`.
- Comandos: `npx vitest run <path>` para teste, `npx tsc --noEmit` para typecheck.

---

## File Structure

**Criar:**

| Arquivo | Responsabilidade |
|---|---|
| `lib/recurring.ts` | Matemática pura: expansão de ocorrências, clamp de fim de mês, classificação de status, estágio de notificação, janela padrão. Sem banco, sem `new Date()`. |
| `lib/db/payables.ts` | Acesso a dados: CRUD da regra, busca das transações casadas, montagem dos `Bill[]` delegando a `lib/recurring.ts`. |
| `app/api/payables/route.ts` | `GET` (lista as contas derivadas) · `POST` (cria regra) |
| `app/api/payables/[id]/route.ts` | `PATCH` (edita/desativa regra) |
| `app/api/payables/[id]/pagar/route.ts` | `POST` — cria a transação do pagamento, com trava de duplicata |
| `app/api/payables/[id]/anexos/route.ts` | `POST` (registra anexo) · `DELETE` (remove anexo) |
| `app/api/cron/avisos-vencimento/route.ts` | Job diário: claim → digest → envio |
| `vercel.json` | Declaração do cron |
| `components/admin/ContasAPagarTab.tsx` | Lista agrupada por estado |
| `components/admin/PayableForm.tsx` | Formulário da regra (criar/editar) |
| `components/admin/PayableRulesPanel.tsx` | Lista das regras cadastradas — editar e desativar |
| `components/admin/RegistrarPagamentoModal.tsx` | Modal de pagamento |
| `components/admin/ContasVencendoBanner.tsx` | Banner do dashboard |

**Modificar:**

| Arquivo | O quê |
|---|---|
| `lib/schema.ts` | Tabelas `payables`, `payable_attachments`, `sent_notifications`; colunas novas em `transactions`; tipos `*Row` |
| `lib/db/index.ts` | `export * from "./payables"` |
| `lib/validation.ts` | `payableInputSchema`, `payableUpdateSchema`, `payablePaymentSchema` |
| `lib/constants.ts` | `PAYMENT_METHODS`, `PAYMENT_METHOD_LABELS`, `PAYABLE_FREQUENCIES` |
| `lib/blob-constants.ts` | `"payable"` em `PRESIGN_KINDS` e `UPLOAD_RULES` |
| `lib/presign.ts` | `case "payable"` em `uploadFolder` |
| `lib/email/templates.ts` | `upcomingBills` |
| `lib/email/notify.ts` | `notifyUpcomingBills` |
| `app/admin/(protected)/financeiro/page.tsx` | Aba "Contas a pagar" |
| `app/admin/(protected)/dashboard/page.tsx` | Banner |
| `components/admin/AdminSidebar.tsx` | Badge de atrasadas |

---

## Task 1: Módulo puro de recorrência

O coração da feature. Tudo aqui é função pura — nenhum import de banco, nenhum `new Date()`.

**Files:**
- Create: `lib/recurring.ts`
- Test: `tests/lib/recurring.test.ts`

**Interfaces:**
- Consumes: nada (primeira task)
- Produces:
  - `type BillStatus = "pago" | "a_vencer" | "vence_hoje" | "atrasado" | "aguardando_conciliacao"`
  - `type NotifyStage = string` (`"d3"` | `"d0"` | `"atraso-7"` | `"atraso-14"` | …)
  - `interface PayableRule { id: number; frequency: string; first_due_date: string; installments: number | null; payment_method: string | null; amount_cents: number | null }`
  - `interface PaidRef { payable_id: number; due_date: string; transaction_id: number; amount: number }`
  - `interface Bill { payable_id: number; due_date: string; installment: number | null; installments: number | null; status: BillStatus; amount_cents: number | null; paid_amount_cents: number | null; transaction_id: number | null }`
  - `lastDayOfMonth(year: number, month: number): number`
  - `addMonthsClamped(iso: string, months: number): string`
  - `daysBetween(from: string, to: string): number`
  - `defaultWindow(today: string): { from: string; to: string }`
  - `expandOccurrences(rule: PayableRule, window: { from: string; to: string }): Occurrence[]`
  - `buildBills(rules: PayableRule[], paid: PaidRef[], window: { from: string; to: string }, today: string): Bill[]`
  - `stageForToday(dueDate: string, paymentMethod: string | null, today: string): NotifyStage | null`

- [ ] **Step 1: Escrever os testes de aritmética de data**

Criar `tests/lib/recurring.test.ts`:

```ts
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
```

> O teste `"volta a 31 em maio"` é o que trava o bug clássico: se cada ocorrência for calculada a partir da anterior em vez da âncora, o dia 31 vira 28 em fevereiro e **nunca mais volta** — o aluguel do resto do ano passa a vencer dia 28.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/lib/recurring.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/recurring"`

- [ ] **Step 3: Implementar a aritmética de data**

Criar `lib/recurring.ts`:

```ts
/**
 * Recorrência de contas a pagar — módulo PURO.
 *
 * Nada aqui toca banco, e "hoje" nunca é lido de `new Date()`: a data de
 * referência entra como parâmetro. Sem isso, o teste de 29 de fevereiro
 * quebraria sozinho em qualquer outro dia do ano.
 *
 * Datas são strings 'YYYY-MM-DD' e comparadas lexicograficamente — o que
 * é correto nesse formato e evita fuso horário por completo.
 */

function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Último dia do mês. `month` é 1-based. */
export function lastDayOfMonth(year: number, month: number): number {
  // Dia 0 do mês seguinte = último dia deste. Date.UTC usa mês 0-based,
  // então passar `month` (1-based) já aponta pro mês seguinte.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Soma meses preservando o dia, com clamp no último dia do mês de destino.
 *
 * SEMPRE calcular a partir da âncora original, nunca encadeando a partir
 * da ocorrência anterior: 31/01 + 1 = 28/02, mas 31/01 + 4 = 31/05.
 * Encadeando, o 28 de fevereiro contaminaria todos os meses seguintes.
 */
export function addMonthsClamped(iso: string, months: number): string {
  const { y, m, d } = parseISO(iso);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return toISO(ny, nm, Math.min(d, lastDayOfMonth(ny, nm)));
}

function toEpochDay(iso: string): number {
  const { y, m, d } = parseISO(iso);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Dias de `from` até `to`. Negativo quando `to` é anterior. */
export function daysBetween(from: string, to: string): number {
  return toEpochDay(to) - toEpochDay(from);
}

/**
 * Janela de derivação: do 1º dia de 2 meses atrás ao último dia do mês
 * seguinte. O piso é o que impede uma regra com vencimento antigo de
 * cuspir dezenas de "atrasados" fantasma no primeiro acesso.
 */
export function defaultWindow(today: string): { from: string; to: string } {
  const { y, m } = parseISO(today);
  const first = toISO(y, m, 1);
  const from = addMonthsClamped(first, -2);
  const { y: ny, m: nm } = parseISO(addMonthsClamped(first, 1));
  return { from, to: toISO(ny, nm, lastDayOfMonth(ny, nm)) };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/lib/recurring.test.ts`
Expected: PASS — 20 testes

- [ ] **Step 5: Escrever os testes de expansão e classificação**

Adicionar a `tests/lib/recurring.test.ts`:

```ts
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
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx vitest run tests/lib/recurring.test.ts`
Expected: FAIL — `expandOccurrences is not a function`

- [ ] **Step 7: Implementar expansão, classificação e estágio**

Adicionar ao fim de `lib/recurring.ts`:

```ts
export type BillStatus =
  | "pago"
  | "a_vencer"
  | "vence_hoje"
  | "atrasado"
  /** Débito automático vencido: o sistema não sabe se debitou. */
  | "aguardando_conciliacao";

export type NotifyStage = string; // 'd3' | 'd0' | 'atraso-7' | 'atraso-14' | …

export interface PayableRule {
  id: number;
  frequency: string;              // 'unica' | 'mensal' | 'anual'
  first_due_date: string;
  installments: number | null;
  payment_method: string | null;
  amount_cents: number | null;
}

export interface Occurrence {
  payable_id: number;
  due_date: string;
  installment: number | null;
  installments: number | null;
}

export interface PaidRef {
  payable_id: number;
  due_date: string;
  transaction_id: number;
  amount: number;
}

export interface Bill extends Occurrence {
  status: BillStatus;
  amount_cents: number | null;
  paid_amount_cents: number | null;
  transaction_id: number | null;
}

/**
 * Expande a regra nos vencimentos dentro da janela.
 *
 * Termina sempre: `due` cresce monotonicamente e o laço para no primeiro
 * valor acima de `window.to`. Ocorrências anteriores a `window.from` são
 * puladas mas contadas — a numeração da parcela é da série, não da janela.
 */
export function expandOccurrences(
  rule: PayableRule,
  window: { from: string; to: string },
): Occurrence[] {
  const step = rule.frequency === "anual" ? 12 : 1;
  const max = rule.frequency === "unica" ? 1 : (rule.installments ?? Number.POSITIVE_INFINITY);
  const out: Occurrence[] = [];

  for (let i = 0; i < max; i++) {
    const due = addMonthsClamped(rule.first_due_date, i * step);
    if (due > window.to) break;
    if (due >= window.from) {
      out.push({
        payable_id: rule.id,
        due_date: due,
        installment: rule.installments ? i + 1 : null,
        installments: rule.installments,
      });
    }
  }
  return out;
}

function classify(
  due_date: string,
  paid: PaidRef | undefined,
  payment_method: string | null,
  today: string,
): BillStatus {
  if (paid) return "pago";
  if (due_date > today) return "a_vencer";
  if (due_date === today) return "vence_hoje";
  return payment_method === "debito_automatico" ? "aguardando_conciliacao" : "atrasado";
}

/** Expande todas as regras, casa com as transações e classifica. */
export function buildBills(
  rules: PayableRule[],
  paid: PaidRef[],
  window: { from: string; to: string },
  today: string,
): Bill[] {
  const byKey = new Map(paid.map((p) => [`${p.payable_id}:${p.due_date}`, p]));

  return rules
    .flatMap((rule) =>
      expandOccurrences(rule, window).map((occ): Bill => {
        const hit = byKey.get(`${occ.payable_id}:${occ.due_date}`);
        return {
          ...occ,
          status: classify(occ.due_date, hit, rule.payment_method, today),
          amount_cents: rule.amount_cents,
          paid_amount_cents: hit?.amount ?? null,
          transaction_id: hit?.transaction_id ?? null,
        };
      }),
    )
    .sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : a.payable_id - b.payable_id));
}

/**
 * Qual estágio de aviso dispara hoje para este vencimento — ou null.
 *
 * Digest diário ingênuo repetiria "vence em 5 dias" cinco dias seguidos e
 * o lojista silenciaria o aviso. Cada conta aparece em D-3, D-0 e depois
 * a cada 7 dias de atraso. Débito automático recebe só o D-3: ele se paga
 * sozinho, e cobrar depois geraria alarme falso todo mês.
 */
export function stageForToday(
  due_date: string,
  payment_method: string | null,
  today: string,
): NotifyStage | null {
  const diff = daysBetween(today, due_date);
  if (diff === 3) return "d3";
  if (payment_method === "debito_automatico") return null;
  if (diff === 0) return "d0";
  if (diff < 0) {
    const late = -diff;
    return late % 7 === 0 ? `atraso-${late}` : null;
  }
  return null;
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx vitest run tests/lib/recurring.test.ts`
Expected: PASS — 43 testes

- [ ] **Step 9: Typecheck e commit**

```bash
npx tsc --noEmit
git add lib/recurring.ts tests/lib/recurring.test.ts
git commit -m "feat(financeiro): módulo puro de recorrência de contas a pagar"
```

---

## Task 2: Schema e migration

**Files:**
- Modify: `lib/schema.ts`
- Modify: `lib/constants.ts`
- Create: `drizzle/000X_*.sql` (gerado)
- Test: `tests/schema/payables.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: tabelas `payables`, `payable_attachments`, `sent_notifications`; colunas `transactions.payable_id`, `transactions.due_date`, `transactions.payment_method`; tipos `PayableRow`, `NewPayable`, `PayableAttachmentRow`; constantes `PAYMENT_METHODS`, `PAYMENT_METHOD_LABELS`, `PAYABLE_FREQUENCIES`

- [ ] **Step 1: Adicionar as constantes**

Em `lib/constants.ts`, após o bloco `EXPENSE_CATEGORIES` (linha ~126):

```ts
// --- Contas a pagar ---

export const PAYABLE_FREQUENCIES = ["unica", "mensal", "anual"] as const;
export type PayableFrequency = (typeof PAYABLE_FREQUENCIES)[number];

export const PAYABLE_FREQUENCY_LABELS: Record<PayableFrequency, string> = {
  unica:  "Única",
  mensal: "Mensal",
  anual:  "Anual",
};

export const PAYMENT_METHODS = [
  "boleto", "pix", "debito_automatico", "cartao", "transferencia", "dinheiro",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  boleto:            "Boleto",
  pix:               "PIX",
  debito_automatico: "Débito automático",
  cartao:            "Cartão",
  transferencia:     "Transferência",
  dinheiro:          "Dinheiro",
};

/** Teto de parcelas — 30 anos de mensais. Guarda o laço de expansão. */
export const MAX_INSTALLMENTS = 360;
```

- [ ] **Step 2: Escrever o teste de forma do schema**

Criar `tests/schema/payables.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { payables, payable_attachments, sent_notifications, transactions } from "@/lib/schema";
import { getTableColumns } from "drizzle-orm";

describe("tabela payables", () => {
  const cols = getTableColumns(payables);

  it("tem todas as colunas do spec", () => {
    expect(Object.keys(cols).sort()).toEqual([
      "active", "amount_cents", "category", "created_at", "description",
      "first_due_date", "frequency", "id", "installments", "notes",
      "payment_method", "supplier", "tenant_id", "type",
    ].sort());
  });

  it("exige tenant_id, type, frequency e first_due_date", () => {
    expect(cols.tenant_id.notNull).toBe(true);
    expect(cols.type.notNull).toBe(true);
    expect(cols.frequency.notNull).toBe(true);
    expect(cols.first_due_date.notNull).toBe(true);
  });

  it("nasce ativa", () => {
    expect(cols.active.default).toBe(true);
  });

  it("NÃO tem end_date — installments é a única forma de encerrar a série", () => {
    expect(cols).not.toHaveProperty("end_date");
  });
});

describe("colunas novas em transactions", () => {
  const cols = getTableColumns(transactions);

  it("liga a transação ao vencimento que ela quita", () => {
    expect(cols).toHaveProperty("payable_id");
    expect(cols).toHaveProperty("due_date");
  });

  it("guarda a forma de pagamento usada", () => {
    expect(cols).toHaveProperty("payment_method");
  });

  it("payable_id é opcional — despesa avulsa continua válida", () => {
    expect(cols.payable_id.notNull).toBe(false);
  });
});

describe("sent_notifications", () => {
  const cols = getTableColumns(sent_notifications);

  it("tem a chave de dedupe", () => {
    expect(cols).toHaveProperty("kind");
    expect(cols).toHaveProperty("ref_key");
    expect(cols.kind.notNull).toBe(true);
    expect(cols.ref_key.notNull).toBe(true);
  });
});

describe("payable_attachments", () => {
  const cols = getTableColumns(payable_attachments);

  it("separa boleto da conta (transaction_id nulo) de comprovante do pagamento", () => {
    expect(cols.payable_id.notNull).toBe(true);
    expect(cols.transaction_id.notNull).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/schema/payables.test.ts`
Expected: FAIL — `payables is not exported`

- [ ] **Step 4: Adicionar as tabelas ao schema**

Em `lib/schema.ts`, após o bloco de `transactions` (linha ~251):

```ts
// --- Contas a pagar (payables) ---

/**
 * A REGRA de uma conta — não a ocorrência. "O aluguel de agosto" é
 * derivado em lib/recurring.ts e nunca persistido, no mesmo idioma de
 * listPendingSales: pagar cria a transação e a pendência sai sozinha.
 *
 * Nunca deletada — apenas `active = false`. Isso preserva o histórico
 * financeiro e evita que um comprovante de pagamento real desapareça
 * junto com a regra.
 */
export const payables = pgTable("payables", {
  id: serial("id").primaryKey(),
  tenant_id: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  /** 'despesa_fixa' | 'despesa_var' — espelha transactions.type. */
  type: text("type").notNull(),
  /** Categoria de EXPENSE_CATEGORIES ou texto livre digitado pelo lojista. */
  category: text("category"),
  description: text("description"),
  /** Beneficiário: "Imobiliária Costa", "Equatorial". */
  supplier: text("supplier"),
  /** Valor PREVISTO em centavos. O cobrado é digitado ao pagar. */
  amount_cents: integer("amount_cents"),
  /** 'unica' | 'mensal' | 'anual' */
  frequency: text("frequency").notNull(),
  /**
   * Âncora da recorrência ('YYYY-MM-DD'). Substitui o trio
   * due_day + due_month + start_date: além de economizar colunas, elimina
   * o estado ambíguo de "due_day 10 com início dia 20" — a ocorrência
   * daquele mês existe ou já venceu?
   */
  first_due_date: text("first_due_date").notNull(),
  /** Total de parcelas; null = indefinido. Substitui end_date (diriam o mesmo). */
  installments: integer("installments"),
  /** 'boleto' | 'pix' | 'debito_automatico' | 'cartao' | 'transferencia' | 'dinheiro' */
  payment_method: text("payment_method"),
  active: boolean("active").notNull().default(true),
  notes: text("notes"),
  created_at: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => ({
  byTenantActive: index("idx_payables_tenant_active").on(table.tenant_id, table.active),
}));

/** Boleto da conta (transaction_id nulo) ou comprovante do pagamento. */
export const payable_attachments = pgTable("payable_attachments", {
  id: serial("id").primaryKey(),
  tenant_id: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  payable_id: integer("payable_id")
    .notNull()
    .references(() => payables.id, { onDelete: "cascade" }),
  transaction_id: integer("transaction_id").references(() => transactions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  size: integer("size"),
  mime_type: text("mime_type"),
  uploaded_by: integer("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  created_at: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => ({
  byTenantPayable: index("idx_payable_att_tenant_payable").on(table.tenant_id, table.payable_id),
}));

/**
 * Trava de idempotência dos avisos. Vercel Cron é at-least-once: sem o
 * índice único, uma segunda execução no mesmo dia reenviaria tudo.
 * O fluxo reivindica (INSERT ON CONFLICT DO NOTHING) ANTES de enviar.
 */
export const sent_notifications = pgTable("sent_notifications", {
  id: serial("id").primaryKey(),
  tenant_id: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  /** 'vencimento' */
  kind: text("kind").notNull(),
  /** "{payable_id}:{due_date}:{estagio}" — estagio ∈ d3 | d0 | atraso-7 | … */
  ref_key: text("ref_key").notNull(),
  sent_at: timestamp("sent_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => ({
  uniqRef: uniqueIndex("uniq_sent_notif").on(table.tenant_id, table.kind, table.ref_key),
}));
```

Adicionar as três colunas em `transactions`, logo após `notes` (linha ~244):

```ts
  /** Vencimento que esta transação quita. Null em despesa avulsa. */
  payable_id: integer("payable_id").references(() => payables.id, { onDelete: "set null" }),
  due_date: text("due_date"),
  /** Forma de pagamento usada — herdada da payable, editável. */
  payment_method: text("payment_method"),
```

> `payables` é declarada **depois** de `transactions` no arquivo, mas a referência circular funciona porque Drizzle avalia os callbacks `() => payables.id` de forma preguiçosa.

Garantir que `boolean` e `uniqueIndex` estão no import de `drizzle-orm/pg-core` no topo do arquivo.

Adicionar os tipos junto aos demais (linha ~397+):

```ts
export type PayableRow = typeof payables.$inferSelect;
export type NewPayable = typeof payables.$inferInsert;
export type PayableAttachmentRow = typeof payable_attachments.$inferSelect;
export type SentNotificationRow = typeof sent_notifications.$inferSelect;
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/schema/payables.test.ts`
Expected: PASS — 11 testes

- [ ] **Step 6: Gerar a migration**

```bash
npm run db:generate
```

Abrir o `.sql` gerado em `drizzle/` e conferir:
- `CREATE TABLE "payables"`, `"payable_attachments"`, `"sent_notifications"`
- `ALTER TABLE "transactions" ADD COLUMN "payable_id"`, `"due_date"`, `"payment_method"`
- `CREATE UNIQUE INDEX "uniq_sent_notif"`
- Nenhum `DROP` — se houver, parar e investigar antes de seguir.

- [ ] **Step 7: Typecheck e commit**

```bash
npx tsc --noEmit
npx vitest run
git add lib/schema.ts lib/constants.ts drizzle/ tests/schema/payables.test.ts
git commit -m "feat(financeiro): schema de contas a pagar, anexos e trava de avisos"
```

> ⚠️ Aplicar no Neon via `migrate.yml` **antes** de qualquer merge na `main` — merge publica produção sozinho.

---

## Task 3: Camada de dados

Fina de propósito: busca linhas e delega a matemática ao módulo puro da Task 1.

**Files:**
- Create: `lib/db/payables.ts`
- Modify: `lib/db/index.ts`
- Test: `tests/lib/db/payables.test.ts`

**Interfaces:**
- Consumes: `buildBills`, `defaultWindow`, `PayableRule`, `PaidRef`, `Bill` de `lib/recurring.ts`; tabelas da Task 2
- Produces:
  - `listPayables(tenantId: number, opts?: { includeInactive?: boolean }): Promise<PayableRow[]>`
  - `listBills(tenantId: number, today: string): Promise<BillWithPayable[]>`
  - `createPayable(tenantId: number, input: PayableInput): Promise<PayableRow>`
  - `updatePayable(tenantId: number, id: number, input: Partial<PayableInput>): Promise<PayableRow | null>`
  - `getPayable(tenantId: number, id: number): Promise<PayableRow | null>`
  - `hasPaymentFor(tenantId: number, payableId: number, dueDate: string): Promise<boolean>`
  - `countOverdue(tenantId: number, today: string): Promise<number>`
  - `interface BillWithPayable extends Bill { category: string | null; description: string | null; supplier: string | null; payment_method: string | null; type: string }`

- [ ] **Step 1: Escrever o teste**

Criar `tests/lib/db/payables.test.ts`. O módulo `lib/db/client` é mockado — o que se testa aqui é a montagem, não o SQL:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const selectRows = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ orderBy: () => selectRows() }) }) }),
  },
  client: {},
}));

describe("listBills", () => {
  beforeEach(() => vi.clearAllMocks());

  it("junta regra e transação numa conta classificada", async () => {
    // 1ª chamada: regras. 2ª: transações casadas.
    selectRows
      .mockResolvedValueOnce([{
        id: 1, tenant_id: 7, type: "despesa_fixa", category: "Aluguel",
        description: "Galpão", supplier: "Imobiliária Costa", amount_cents: 450_000,
        frequency: "mensal", first_due_date: "2026-06-10", installments: null,
        payment_method: "boleto", active: true, notes: null, created_at: "2026-06-01T00:00:00Z",
      }])
      .mockResolvedValueOnce([
        { payable_id: 1, due_date: "2026-08-10", transaction_id: 99, amount: 462_000 },
      ]);

    const { listBills } = await import("@/lib/db/payables");
    const bills = await listBills(7, "2026-08-13");

    const ago = bills.find((b) => b.due_date === "2026-08-10")!;
    expect(ago.status).toBe("pago");
    expect(ago.paid_amount_cents).toBe(462_000);
    expect(ago.category).toBe("Aluguel");
    expect(ago.supplier).toBe("Imobiliária Costa");

    const jul = bills.find((b) => b.due_date === "2026-07-10")!;
    expect(jul.status).toBe("atrasado");
  });

  it("devolve vazio quando o tenant não tem regra", async () => {
    selectRows.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const { listBills } = await import("@/lib/db/payables");
    expect(await listBills(7, "2026-08-13")).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/lib/db/payables.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/db/payables"`

- [ ] **Step 3: Implementar**

Criar `lib/db/payables.ts`:

```ts
import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import { db } from "./client";
import { payables, transactions, type PayableRow } from "@/lib/schema";
import {
  buildBills, defaultWindow,
  type Bill, type PaidRef, type PayableRule,
} from "@/lib/recurring";

export interface BillWithPayable extends Bill {
  type: string;
  category: string | null;
  description: string | null;
  supplier: string | null;
  payment_method: string | null;
}

export interface PayableInput {
  type: string;
  category: string | null;
  description: string | null;
  supplier: string | null;
  amount_cents: number | null;
  frequency: string;
  first_due_date: string;
  installments: number | null;
  payment_method: string | null;
  notes: string | null;
}

export async function listPayables(
  tenantId: number,
  opts: { includeInactive?: boolean } = {},
): Promise<PayableRow[]> {
  const where = opts.includeInactive
    ? eq(payables.tenant_id, tenantId)
    : and(eq(payables.tenant_id, tenantId), eq(payables.active, true));
  return db.select().from(payables).where(where).orderBy(payables.first_due_date);
}

export async function getPayable(tenantId: number, id: number): Promise<PayableRow | null> {
  const [row] = await db
    .select().from(payables)
    .where(and(eq(payables.tenant_id, tenantId), eq(payables.id, id)))
    .limit(1);
  return row ?? null;
}

/**
 * Contas da janela padrão, já classificadas. Duas queries; a expansão e a
 * classificação ficam no módulo puro (lib/recurring.ts).
 */
export async function listBills(tenantId: number, today: string): Promise<BillWithPayable[]> {
  const window = defaultWindow(today);
  const rules = await listPayables(tenantId);
  if (rules.length === 0) return [];

  const paidRows = await db
    .select({
      payable_id: transactions.payable_id,
      due_date: transactions.due_date,
      transaction_id: transactions.id,
      amount: transactions.amount,
    })
    .from(transactions)
    .where(and(
      eq(transactions.tenant_id, tenantId),
      isNotNull(transactions.payable_id),
      gte(transactions.due_date, window.from),
      lte(transactions.due_date, window.to),
    ))
    .orderBy(transactions.due_date);

  const paid = paidRows as PaidRef[];
  const byId = new Map(rules.map((r) => [r.id, r]));
  const asRules: PayableRule[] = rules.map((r) => ({
    id: r.id,
    frequency: r.frequency,
    first_due_date: r.first_due_date,
    installments: r.installments,
    payment_method: r.payment_method,
    amount_cents: r.amount_cents,
  }));

  return buildBills(asRules, paid, window, today).map((b): BillWithPayable => {
    const p = byId.get(b.payable_id)!;
    return {
      ...b,
      type: p.type,
      category: p.category,
      description: p.description,
      supplier: p.supplier,
      payment_method: p.payment_method,
    };
  });
}

export async function createPayable(tenantId: number, input: PayableInput): Promise<PayableRow> {
  const [row] = await db.insert(payables).values({ tenant_id: tenantId, ...input }).returning();
  return row;
}

/** `active: false` é a única forma de encerrar uma conta — não há delete. */
export async function updatePayable(
  tenantId: number,
  id: number,
  input: Partial<PayableInput> & { active?: boolean },
): Promise<PayableRow | null> {
  if (Object.keys(input).length > 0) {
    await db.update(payables).set(input)
      .where(and(eq(payables.tenant_id, tenantId), eq(payables.id, id)));
  }
  return getPayable(tenantId, id);
}

/** Trava de duplicata: já existe transação para este par (regra, vencimento)? */
export async function hasPaymentFor(
  tenantId: number, payableId: number, dueDate: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(
      eq(transactions.tenant_id, tenantId),
      eq(transactions.payable_id, payableId),
      eq(transactions.due_date, dueDate),
    ))
    .limit(1);
  return !!row;
}

/** Alimenta o badge da sidebar e o banner do dashboard. */
export async function countOverdue(tenantId: number, today: string): Promise<number> {
  const bills = await listBills(tenantId, today);
  return bills.filter((b) => b.status === "atrasado").length;
}
```

Em `lib/db/index.ts`, adicionar após `export * from "./coupons";`:

```ts
export * from "./payables";
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/lib/db/payables.test.ts`
Expected: PASS — 2 testes

- [ ] **Step 5: Typecheck e commit**

```bash
npx tsc --noEmit
git add lib/db/payables.ts lib/db/index.ts tests/lib/db/payables.test.ts
git commit -m "feat(financeiro): camada de dados das contas a pagar"
```

---

## Task 4: Validação e rotas CRUD

**Files:**
- Modify: `lib/validation.ts`
- Create: `app/api/payables/route.ts`
- Create: `app/api/payables/[id]/route.ts`
- Test: `tests/api/payables.test.ts`

**Interfaces:**
- Consumes: `listBills`, `createPayable`, `updatePayable`, `listPayables` de `lib/db`; `withTenant`, `parseBody`, `ApiError` de `lib/api`
- Produces: `payableInputSchema`, `payableUpdateSchema` em `lib/validation.ts`; rotas `GET/POST /api/payables`, `PATCH /api/payables/[id]`

- [ ] **Step 1: Adicionar os schemas Zod**

Em `lib/validation.ts`, após `transactionUpdateSchema`:

```ts
// ---------- Contas a pagar ----------

/**
 * Objeto base SEM refinement. Existe separado porque `.partial()` do Zod 4
 * lança "cannot be used on object schemas containing refinements" — e
 * `.innerType()` não existe nesta versão. Derivar create e update daqui é
 * a única forma de compartilhar os campos sem duplicá-los.
 */
const payableBaseSchema = z.object({
  type: z.enum(["despesa_fixa", "despesa_var"]),
  category: trimmed(80).nullable().optional(),
  description: trimmed(120).nullable().optional(),
  supplier: trimmed(120).nullable().optional(),
  amount_cents: nonNegativeInt.nullable().optional(),
  frequency: z.enum(PAYABLE_FREQUENCIES),
  first_due_date: isoDate,
  installments: z.number().int().min(1).max(MAX_INSTALLMENTS).nullable().optional(),
  payment_method: z.enum(PAYMENT_METHODS).nullable().optional(),
  notes: trimmed(2000).nullable().optional(),
});

/** 'unica' tem exatamente uma ocorrência — parcelamento não faz sentido. */
function refineUnicaSemParcelas(
  data: { frequency?: string; installments?: number | null },
  ctx: z.RefinementCtx,
) {
  if (data.frequency === "unica" && data.installments && data.installments > 1) {
    ctx.addIssue({
      code: "custom",
      path: ["installments"],
      message: "conta única não pode ser parcelada — use frequência mensal",
    });
  }
}

export const payableInputSchema = payableBaseSchema.superRefine(refineUnicaSemParcelas);

export const payableUpdateSchema = payableBaseSchema
  .partial()
  .extend({ active: z.boolean().optional() })
  .superRefine(refineUnicaSemParcelas);

export const payablePaymentSchema = z.object({
  due_date: isoDate,
  amount: nonNegativeInt.refine((v) => v > 0, "valor deve ser maior que zero"),
  date: isoDate,
  payment_method: z.enum(PAYMENT_METHODS).nullable().optional(),
  notes: trimmed(2000).nullable().optional(),
});
```

Adicionar ao import de `@/lib/constants` no topo do arquivo: `PAYABLE_FREQUENCIES`, `PAYMENT_METHODS`, `MAX_INSTALLMENTS`.

- [ ] **Step 2: Escrever o teste das rotas**

Criar `tests/api/payables.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const listBills = vi.fn();
const createPayable = vi.fn();
const updatePayable = vi.fn();

vi.mock("@/lib/db", () => ({ listBills, createPayable, updatePayable }));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    withTenant:
      (handler: (req: unknown, ctx: { tenantId: number; params: Record<string, string> }) => unknown) =>
      (req: unknown, routeCtx: { params: Promise<Record<string, string>> }) =>
        Promise.resolve(routeCtx.params).then((params) => handler(req, { tenantId: 7, params })),
  };
});

const post = (body: unknown) =>
  ({ json: async () => body, url: "http://x/api/payables" }) as never;

const ctx = (params: Record<string, string> = {}) =>
  ({ params: Promise.resolve(params) }) as never;

const VALID = {
  type: "despesa_fixa",
  category: "Aluguel",
  description: "Galpão",
  supplier: "Imobiliária Costa",
  amount_cents: 450_000,
  frequency: "mensal",
  first_due_date: "2026-09-10",
  installments: null,
  payment_method: "boleto",
};

describe("GET /api/payables", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devolve as contas do tenant da sessão", async () => {
    listBills.mockResolvedValue([{ payable_id: 1, due_date: "2026-09-10", status: "a_vencer" }]);
    const { GET } = await import("@/app/api/payables/route");

    const res = await GET({ url: "http://x/api/payables" } as never, ctx());

    expect(res.status).toBe(200);
    expect(listBills).toHaveBeenCalledWith(7, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });
});

describe("POST /api/payables", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cria a regra e devolve 201", async () => {
    createPayable.mockResolvedValue({ id: 1, ...VALID });
    const { POST } = await import("@/app/api/payables/route");

    const res = await POST(post(VALID), ctx());

    expect(res.status).toBe(201);
    expect(createPayable).toHaveBeenCalledWith(7, expect.objectContaining({ category: "Aluguel" }));
  });

  it("400 quando a frequência é inválida", async () => {
    const { POST } = await import("@/app/api/payables/route");
    const res = await POST(post({ ...VALID, frequency: "semanal" }), ctx());
    expect(res.status).toBe(400);
    expect(createPayable).not.toHaveBeenCalled();
  });

  it("400 quando conta única vem parcelada", async () => {
    const { POST } = await import("@/app/api/payables/route");
    const res = await POST(post({ ...VALID, frequency: "unica", installments: 3 }), ctx());
    expect(res.status).toBe(400);
  });

  it("400 quando o vencimento não é uma data ISO", async () => {
    const { POST } = await import("@/app/api/payables/route");
    const res = await POST(post({ ...VALID, first_due_date: "10/09/2026" }), ctx());
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/payables/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("desativa a conta", async () => {
    updatePayable.mockResolvedValue({ id: 1, active: false });
    const { PATCH } = await import("@/app/api/payables/[id]/route");

    const res = await PATCH(post({ active: false }), ctx({ id: "1" }));

    expect(res.status).toBe(200);
    expect(updatePayable).toHaveBeenCalledWith(7, 1, { active: false });
  });

  it("404 quando a conta é de outro tenant", async () => {
    updatePayable.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/payables/[id]/route");
    const res = await PATCH(post({ active: false }), ctx({ id: "999" }));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/api/payables.test.ts`
Expected: FAIL — não resolve `@/app/api/payables/route`

- [ ] **Step 4: Implementar as rotas**

Criar `app/api/payables/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createPayable, listBills } from "@/lib/db";
import { parseBody, withTenant } from "@/lib/api";
import { payableInputSchema } from "@/lib/validation";

/** Data de hoje em São Paulo — o cron e a UI têm de concordar sobre "hoje". */
function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export const GET = withTenant(async (_req, { tenantId }) => {
  return NextResponse.json(await listBills(tenantId, todayISO()));
});

export const POST = withTenant(async (req, { tenantId }) => {
  const input = await parseBody(req, payableInputSchema);
  const row = await createPayable(tenantId, {
    type: input.type,
    category: input.category ?? null,
    description: input.description ?? null,
    supplier: input.supplier ?? null,
    amount_cents: input.amount_cents ?? null,
    frequency: input.frequency,
    first_due_date: input.first_due_date,
    installments: input.installments ?? null,
    payment_method: input.payment_method ?? null,
    notes: input.notes ?? null,
  });
  return NextResponse.json(row, { status: 201 });
});
```

> `Intl.DateTimeFormat` com locale `en-CA` devolve `YYYY-MM-DD` direto — sem montar string à mão e sem depender do fuso do servidor, que na Vercel é UTC.

Criar `app/api/payables/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { updatePayable } from "@/lib/db";
import { ApiError, parseBody, withTenant } from "@/lib/api";
import { payableUpdateSchema } from "@/lib/validation";

export const PATCH = withTenant<{ id: string }>(async (req, { tenantId, params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError("id inválido", 400);

  const input = await parseBody(req, payableUpdateSchema);
  const row = await updatePayable(tenantId, id, input);
  if (!row) throw new ApiError("Conta não encontrada", 404);

  return NextResponse.json(row);
});
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/api/payables.test.ts`
Expected: PASS — 7 testes

- [ ] **Step 6: Typecheck e commit**

```bash
npx tsc --noEmit
git add lib/validation.ts app/api/payables tests/api/payables.test.ts
git commit -m "feat(financeiro): rotas de CRUD das contas a pagar"
```

---

## Task 5: Rota de pagamento

**Files:**
- Create: `app/api/payables/[id]/pagar/route.ts`
- Modify: `types/transaction.ts` (os 3 campos no tipo)
- Modify: `lib/db/transactions.ts` (gravar os 3 campos)
- Test: `tests/api/payables-pagar.test.ts`

**Interfaces:**
- Consumes: `getPayable`, `hasPaymentFor`, `createTransaction`; `payablePaymentSchema`
- Produces: rota `POST /api/payables/[id]/pagar`

- [ ] **Step 1: Estender `createTransaction`**

O tipo vive em `types/transaction.ts:4`, **não** em `lib/db/transactions.ts` — `TransactionInput` é `Omit<Transaction, "id" | "created_at">`. Adicionar à interface `Transaction`, junto de `notes`:

```ts
  /** Vencimento que esta transação quita. Null em despesa avulsa. */
  payable_id?: number | null;
  due_date?: string | null;
  payment_method?: string | null;
```

> **Opcionais de propósito.** `TransactionInput` deriva de `Transaction` por `Omit`, então campo obrigatório aqui quebraria todos os callers existentes (`app/api/transactions/route.ts`, criação de comissão) que não conhecem estes campos.

E em `lib/db/transactions.ts`, ao `.values({...})` do insert, junto de `notes`:

```ts
        payable_id: input.payable_id ?? null,
        due_date: input.due_date ?? null,
        payment_method: input.payment_method ?? null,
```

- [ ] **Step 2: Escrever o teste**

Criar `tests/api/payables-pagar.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getPayable = vi.fn();
const hasPaymentFor = vi.fn();
const createTransaction = vi.fn();

vi.mock("@/lib/db", () => ({ getPayable, hasPaymentFor, createTransaction }));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    withTenant:
      (handler: (req: unknown, ctx: { tenantId: number; params: Record<string, string> }) => unknown) =>
      (req: unknown, routeCtx: { params: Promise<Record<string, string>> }) =>
        Promise.resolve(routeCtx.params).then((params) => handler(req, { tenantId: 7, params })),
  };
});

const post = (body: unknown) => ({ json: async () => body, url: "http://x" }) as never;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never;

const ALUGUEL = {
  id: 1, tenant_id: 7, type: "despesa_fixa", category: "Aluguel",
  amount_cents: 450_000, payment_method: "boleto",
};

const PAGAMENTO = {
  due_date: "2026-08-10",
  amount: 462_000,
  date: "2026-08-12",
  payment_method: "pix",
};

describe("POST /api/payables/[id]/pagar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPayable.mockResolvedValue(ALUGUEL);
    hasPaymentFor.mockResolvedValue(false);
    createTransaction.mockResolvedValue({ id: 99 });
  });

  it("cria a transação com tipo e categoria da conta", async () => {
    const { POST } = await import("@/app/api/payables/[id]/pagar/route");

    const res = await POST(post(PAGAMENTO), ctx("1"));

    expect(res.status).toBe(201);
    expect(createTransaction).toHaveBeenCalledWith(7, expect.objectContaining({
      type: "despesa_fixa",
      category: "Aluguel",
      amount: 462_000,       // o digitado, não o previsto
      date: "2026-08-12",    // data do pagamento
      due_date: "2026-08-10",// vencimento — os dois fatos sobrevivem
      payable_id: 1,
      payment_method: "pix", // sobrescreve o da conta
    }));
  });

  it("herda a forma de pagamento da conta quando não vem no body", async () => {
    const { POST } = await import("@/app/api/payables/[id]/pagar/route");
    const { payment_method: _drop, ...semMetodo } = PAGAMENTO;

    await POST(post(semMetodo), ctx("1"));

    expect(createTransaction).toHaveBeenCalledWith(7, expect.objectContaining({
      payment_method: "boleto",
    }));
  });

  it("409 quando o vencimento já foi pago", async () => {
    hasPaymentFor.mockResolvedValue(true);
    const { POST } = await import("@/app/api/payables/[id]/pagar/route");

    const res = await POST(post(PAGAMENTO), ctx("1"));

    expect(res.status).toBe(409);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("404 quando a conta é de outro tenant", async () => {
    getPayable.mockResolvedValue(null);
    const { POST } = await import("@/app/api/payables/[id]/pagar/route");
    const res = await POST(post(PAGAMENTO), ctx("999"));
    expect(res.status).toBe(404);
  });

  it("400 quando o valor é zero", async () => {
    const { POST } = await import("@/app/api/payables/[id]/pagar/route");
    const res = await POST(post({ ...PAGAMENTO, amount: 0 }), ctx("1"));
    expect(res.status).toBe(400);
    expect(createTransaction).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/api/payables-pagar.test.ts`
Expected: FAIL — rota não existe

- [ ] **Step 4: Implementar**

Criar `app/api/payables/[id]/pagar/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createTransaction, getPayable, hasPaymentFor } from "@/lib/db";
import { ApiError, parseBody, withTenant } from "@/lib/api";
import { payablePaymentSchema } from "@/lib/validation";

/**
 * Registra o pagamento de UM vencimento: cria uma transação normal
 * (despesa_fixa/despesa_var) carimbada com payable_id + due_date. A
 * ocorrência sai da lista de pendentes sozinha — o status é derivado.
 */
export const POST = withTenant<{ id: string }>(async (req, { tenantId, params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError("id inválido", 400);

  const input = await parseBody(req, payablePaymentSchema);

  const payable = await getPayable(tenantId, id);
  if (!payable) throw new ApiError("Conta não encontrada", 404);

  // Trava de duplicata — mesma postura da trava de venda duplicada.
  if (await hasPaymentFor(tenantId, id, input.due_date)) {
    throw new ApiError("Este vencimento já foi pago.", 409);
  }

  const tx = await createTransaction(tenantId, {
    type: payable.type,
    category: payable.category,
    amount: input.amount,
    date: input.date,
    due_date: input.due_date,
    payable_id: id,
    payment_method: input.payment_method ?? payable.payment_method,
    notes: input.notes ?? null,
    vehicle_id: null,
    seller_id: null,
    buyer_name: null,
    buyer_phone: null,
  });

  return NextResponse.json(tx, { status: 201 });
});
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/api/payables-pagar.test.ts`
Expected: PASS — 5 testes

- [ ] **Step 6: Rodar a suíte inteira, typecheck e commit**

```bash
npx vitest run
npx tsc --noEmit
git add app/api/payables lib/db/transactions.ts tests/api/payables-pagar.test.ts
git commit -m "feat(financeiro): registrar pagamento de conta com trava de duplicata"
```

---

## Task 6: Anexos (boleto e comprovante)

**Files:**
- Modify: `lib/blob-constants.ts`
- Modify: `lib/presign.ts`
- Create: `app/api/payables/[id]/anexos/route.ts`
- Test: `tests/lib/presign.test.ts` (estender)

**Interfaces:**
- Consumes: `payable_attachments` da Task 2; `getPayable` da Task 3
- Produces: `PresignKind` ganha `"payable"`; rotas `POST`/`DELETE /api/payables/[id]/anexos`; `listPayableAttachments`, `addPayableAttachment`, `deletePayableAttachment` em `lib/db/payables.ts`

- [ ] **Step 1: Escrever o teste do presign**

Adicionar a `tests/lib/presign.test.ts`:

```ts
describe("kind payable", () => {
  it("aceita PDF até o limite de documento", () => {
    expect(() => validateUpload({
      kind: "payable", contentType: "application/pdf", size: 1024,
    })).not.toThrow();
  });

  it("recusa arquivo acima do limite", () => {
    expect(() => validateUpload({
      kind: "payable", contentType: "application/pdf", size: DOC_MAX_BYTES + 1,
    })).toThrow(UploadValidationError);
  });

  it("não exige vehicleId", () => {
    expect(() => uploadFolder("payable", 7)).not.toThrow();
  });

  it("guarda em pasta própria por tenant", () => {
    expect(uploadFolder("payable", 7)).toBe("tenants/7/payables");
  });
});
```

Ajustar os imports do arquivo de teste para incluir `DOC_MAX_BYTES` e `UploadValidationError` se ainda não estiverem.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/lib/presign.test.ts`
Expected: FAIL — `kind payable` inválido

- [ ] **Step 3: Registrar o kind**

Em `lib/blob-constants.ts`:

```ts
export const PRESIGN_KINDS = ["photo", "document", "logo", "hero", "payable"] as const;
```

E em `UPLOAD_RULES`:

```ts
  payable:  { allowedMimes: DOC_MIMES,   maxBytes: DOC_MAX_BYTES,   needsVehicle: false },
```

Em `lib/presign.ts`, no `switch` de `uploadFolder`, antes do `default`:

```ts
    case "payable":
      return `tenants/${tenantId}/payables`;
```

> Pasta **nova**, nunca alteração das existentes: `keyFromCdnUrl` e `s3Delete` fazem o caminho de volta a partir da convenção, então mexer nas antigas quebraria a deleção de tudo que já está gravado.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/lib/presign.test.ts`
Expected: PASS

- [ ] **Step 5: Adicionar as funções de dados**

Em `lib/db/payables.ts`, ao final:

```ts
import { payable_attachments, type PayableAttachmentRow } from "@/lib/schema";

export async function listPayableAttachments(
  tenantId: number, payableId: number,
): Promise<PayableAttachmentRow[]> {
  return db.select().from(payable_attachments)
    .where(and(
      eq(payable_attachments.tenant_id, tenantId),
      eq(payable_attachments.payable_id, payableId),
    ))
    .orderBy(payable_attachments.created_at);
}

export async function addPayableAttachment(
  tenantId: number,
  payableId: number,
  input: {
    name: string; url: string; size: number | null;
    mime_type: string | null; transaction_id: number | null; uploaded_by: number | null;
  },
): Promise<PayableAttachmentRow> {
  const [row] = await db.insert(payable_attachments)
    .values({ tenant_id: tenantId, payable_id: payableId, ...input })
    .returning();
  return row;
}

export async function deletePayableAttachment(
  tenantId: number, attachmentId: number,
): Promise<PayableAttachmentRow | null> {
  const [row] = await db.delete(payable_attachments)
    .where(and(
      eq(payable_attachments.tenant_id, tenantId),
      eq(payable_attachments.id, attachmentId),
    ))
    .returning();
  return row ?? null;
}
```

Adicionar `payable_attachments` e o tipo ao import de `@/lib/schema` no topo do arquivo.

- [ ] **Step 6: Implementar a rota**

Criar `app/api/payables/[id]/anexos/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addPayableAttachment, deletePayableAttachment, getPayable } from "@/lib/db";
import { ApiError, parseBody, withTenant } from "@/lib/api";
import { deleteFromBlob } from "@/lib/blob";

const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(160),
  url: z.string().url(),
  size: z.number().int().positive().nullable().optional(),
  mime_type: z.string().max(100).nullable().optional(),
  transaction_id: z.number().int().positive().nullable().optional(),
});

export const POST = withTenant<{ id: string }>(async (req, { tenantId, params }) => {
  const payableId = Number(params.id);
  if (!Number.isInteger(payableId) || payableId <= 0) throw new ApiError("id inválido", 400);
  if (!(await getPayable(tenantId, payableId))) throw new ApiError("Conta não encontrada", 404);

  const input = await parseBody(req, attachmentSchema);
  const row = await addPayableAttachment(tenantId, payableId, {
    name: input.name,
    url: input.url,
    size: input.size ?? null,
    mime_type: input.mime_type ?? null,
    transaction_id: input.transaction_id ?? null,
    uploaded_by: null,
  });
  return NextResponse.json(row, { status: 201 });
});

export const DELETE = withTenant<{ id: string }>(async (req, { tenantId }) => {
  const attachmentId = Number((req as NextRequest).nextUrl.searchParams.get("anexo"));
  if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
    throw new ApiError("anexo inválido", 400);
  }

  const row = await deletePayableAttachment(tenantId, attachmentId);
  if (!row) throw new ApiError("Anexo não encontrado", 404);

  // Best-effort: a linha já saiu do banco; um objeto órfão no S3 é
  // preferível a uma linha fantasma apontando pra arquivo inexistente.
  await deleteFromBlob(row.url).catch((err) => console.error("[s3] delete anexo falhou:", err));

  return NextResponse.json({ ok: true });
});
```

> `deleteFromBlob(url)` (`lib/blob.ts:72`) é o helper certo — ele converte URL→key via `keyFromCdnUrl` e trata o stub local de dev. `s3Delete` (`lib/s3.ts:38`) recebe **key**, não URL, e chamá-lo direto com a URL apagaria nada silenciosamente.

- [ ] **Step 7: Typecheck e commit**

```bash
npx tsc --noEmit
npx vitest run
git add lib/blob-constants.ts lib/presign.ts lib/db/payables.ts app/api/payables tests/lib/presign.test.ts
git commit -m "feat(financeiro): anexo de boleto e comprovante nas contas a pagar"
```

---

## Task 7: Template e notificação de e-mail

**Files:**
- Modify: `lib/email/templates.ts`
- Modify: `lib/email/notify.ts`
- Test: `tests/lib/email-templates.test.ts` (estender)

**Interfaces:**
- Consumes: `RenderedEmail`, `layout`, `button`, `esc` de `lib/email/templates.ts`
- Produces:
  - `upcomingBills(p: { dealershipName: string; panelUrl: string; bills: BillLine[] }): RenderedEmail`
  - `interface BillLine { label: string; dueDate: string; amountCents: number | null; status: "a_vencer" | "vence_hoje" | "atrasado" }`
  - `notifyUpcomingBills(tenant: TenantRow, bills: BillLine[]): Promise<void>`

- [ ] **Step 1: Escrever o teste**

Adicionar a `tests/lib/email-templates.test.ts`:

```ts
import { upcomingBills } from "@/lib/email/templates";

describe("upcomingBills", () => {
  const bills = [
    { label: "Aluguel — Imobiliária Costa", dueDate: "2026-08-16", amountCents: 450_000, status: "a_vencer" as const },
    { label: "Energia — Equatorial", dueDate: "2026-08-13", amountCents: null, status: "vence_hoje" as const },
  ];

  it("põe a contagem no assunto", () => {
    const r = upcomingBills({ dealershipName: "Auto Brasil", panelUrl: "https://x/admin/financeiro", bills });
    expect(r.subject).toContain("2");
  });

  it("lista cada conta com data formatada em pt-BR", () => {
    const r = upcomingBills({ dealershipName: "Auto Brasil", panelUrl: "https://x", bills });
    expect(r.html).toContain("Aluguel");
    expect(r.html).toContain("16/08/2026");
    expect(r.html).toContain("R$ 4.500,00");
  });

  it("mostra travessão quando não há valor previsto", () => {
    const r = upcomingBills({ dealershipName: "Auto Brasil", panelUrl: "https://x", bills });
    expect(r.html).toContain("Energia");
  });

  it("escapa HTML no nome do fornecedor", () => {
    const r = upcomingBills({
      dealershipName: "Auto Brasil",
      panelUrl: "https://x",
      bills: [{ label: "<script>alert(1)</script>", dueDate: "2026-08-16", amountCents: 100, status: "a_vencer" }],
    });
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;");
  });

  it("destaca as atrasadas", () => {
    const r = upcomingBills({
      dealershipName: "Auto Brasil",
      panelUrl: "https://x",
      bills: [{ label: "IPTU", dueDate: "2026-08-01", amountCents: 90_000, status: "atrasado" }],
    });
    expect(r.subject.toLowerCase()).toContain("atrasada");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/lib/email-templates.test.ts`
Expected: FAIL — `upcomingBills is not a function`

- [ ] **Step 3: Implementar o template**

Em `lib/email/templates.ts`, ao final:

```ts
// — Contas a vencer → gestor da concessionária ————————————————————————

export interface BillLine {
  label: string;
  dueDate: string;                                   // 'YYYY-MM-DD'
  amountCents: number | null;
  status: "a_vencer" | "vence_hoje" | "atrasado";
}

function brDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function brMoney(cents: number | null): string {
  if (cents === null) return "—";
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function upcomingBills(p: {
  dealershipName: string;
  panelUrl: string;
  bills: BillLine[];
}): RenderedEmail {
  const overdue = p.bills.filter((b) => b.status === "atrasado").length;
  const subject = overdue > 0
    ? `${overdue} conta${overdue > 1 ? "s" : ""} atrasada${overdue > 1 ? "s" : ""} — ${p.dealershipName}`
    : `${p.bills.length} conta${p.bills.length > 1 ? "s" : ""} a vencer — ${p.dealershipName}`;

  const rows = p.bills.map((b) => {
    const cor = b.status === "atrasado" ? "#DC2626" : b.status === "vence_hoje" ? "#B45309" : "#1E293B";
    const rotulo = b.status === "atrasado" ? "atrasada" : b.status === "vence_hoje" ? "vence hoje" : "a vencer";
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #e2e8f0">
        <strong style="color:${cor}">${esc(b.label)}</strong><br>
        <span style="color:#64748b;font-size:13px">${brDate(b.dueDate)} · ${rotulo}</span>
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap">
        ${brMoney(b.amountCents)}
      </td>
    </tr>`;
  }).join("");

  return {
    subject,
    html: layout(`
      <p>Olá! Um resumo das contas de <strong>${esc(p.dealershipName)}</strong>:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">${rows}</table>
      ${button(p.panelUrl, "Abrir o financeiro")}
      <p style="color:#94a3b8;font-size:12px">
        Você recebe este aviso 3 dias antes do vencimento, no dia, e semanalmente enquanto houver atraso.
      </p>
    `),
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/lib/email-templates.test.ts`
Expected: PASS

- [ ] **Step 5: Adicionar o notify**

Em `lib/email/notify.ts`, ao final:

```ts
/** Contas a vencer / atrasadas → gestor da concessionária. */
export async function notifyUpcomingBills(
  tenant: TenantRow,
  bills: tpl.BillLine[],
): Promise<void> {
  if (bills.length === 0) return;
  const to = await tenantRecipient(tenant);
  if (!to) return;

  const r = tpl.upcomingBills({
    dealershipName: tenant.name,
    panelUrl: `${tenantSiteUrl(tenant)}/admin/financeiro?tab=contas`,
    bills,
  });
  await sendEmail({ to, subject: r.subject, html: r.html });
}
```

> **Diferente das outras funções do arquivo, esta NÃO engole erro.** As demais são fire-and-forget (`void notifyX(...)`) e nunca podem derrubar o fluxo do usuário. Esta é chamada pelo cron, que precisa saber da falha para **devolver o claim** e retentar amanhã. Engolir aqui produziria silêncio permanente.

- [ ] **Step 6: Typecheck e commit**

```bash
npx tsc --noEmit
npx vitest run tests/lib/
git add lib/email/templates.ts lib/email/notify.ts tests/lib/email-templates.test.ts
git commit -m "feat(email): digest de contas a vencer"
```

---

## Task 8: Cron de avisos

**Files:**
- Create: `app/api/cron/avisos-vencimento/route.ts`
- Create: `vercel.json`
- Modify: `lib/db/payables.ts` (claim/release)
- Test: `tests/api/cron-avisos.test.ts`

**Interfaces:**
- Consumes: `stageForToday` da Task 1; `listBills` da Task 3; `notifyUpcomingBills` da Task 7
- Produces:
  - `claimNotifications(tenantId: number, kind: string, refKeys: string[]): Promise<string[]>` — devolve só as que inseriu
  - `releaseNotifications(tenantId: number, kind: string, refKeys: string[]): Promise<void>`
  - `listTenantsForBillDigest(): Promise<TenantRow[]>`
  - rota `GET /api/cron/avisos-vencimento`

- [ ] **Step 1: Adicionar claim e release**

Em `lib/db/payables.ts`:

```ts
import { inArray } from "drizzle-orm";
import { sent_notifications, tenants } from "@/lib/schema";

/**
 * Reivindica os avisos do dia. Devolve APENAS as chaves que este processo
 * conseguiu inserir — as já existentes foram enviadas por outra execução.
 *
 * Vercel Cron é at-least-once. Reivindicar ANTES de enviar é a única
 * ordem que erra pro lado recuperável: enviar-e-depois-registrar duplica
 * e-mail numa segunda execução, e registrar-sem-enviar cala pra sempre.
 * Mesmo padrão do claimTenantForCheckout.
 */
export async function claimNotifications(
  tenantId: number, kind: string, refKeys: string[],
): Promise<string[]> {
  if (refKeys.length === 0) return [];
  const inserted = await db
    .insert(sent_notifications)
    .values(refKeys.map((ref_key) => ({ tenant_id: tenantId, kind, ref_key })))
    .onConflictDoNothing()
    .returning({ ref_key: sent_notifications.ref_key });
  return inserted.map((r) => r.ref_key);
}

/** Devolve os claims quando o envio falha, para o cron de amanhã retentar. */
export async function releaseNotifications(
  tenantId: number, kind: string, refKeys: string[],
): Promise<void> {
  if (refKeys.length === 0) return;
  await db.delete(sent_notifications).where(and(
    eq(sent_notifications.tenant_id, tenantId),
    eq(sent_notifications.kind, kind),
    inArray(sent_notifications.ref_key, refKeys),
  ));
}

/** Tenants elegíveis ao digest — suspenso e diagnóstico ficam de fora. */
export async function listTenantsForBillDigest() {
  return db.select().from(tenants).where(eq(tenants.status, "active"));
}
```

- [ ] **Step 2: Escrever o teste**

Criar `tests/api/cron-avisos.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const listTenantsForBillDigest = vi.fn();
const listBills = vi.fn();
const claimNotifications = vi.fn();
const releaseNotifications = vi.fn();
const notifyUpcomingBills = vi.fn();

vi.mock("@/lib/db", () => ({
  listTenantsForBillDigest, listBills, claimNotifications, releaseNotifications,
}));
vi.mock("@/lib/email/notify", () => ({ notifyUpcomingBills }));

const TENANT = { id: 7, name: "Auto Brasil", slug: "auto-brasil", status: "active", contact_email: "x@y.com" };

const req = (secret?: string) =>
  ({ headers: { get: (k: string) => (k.toLowerCase() === "authorization" && secret ? `Bearer ${secret}` : null) } }) as never;

// D-3 a partir de 2026-08-13 → vence 2026-08-16
const BILL_D3 = {
  payable_id: 1, due_date: "2026-08-16", status: "a_vencer",
  amount_cents: 450_000, category: "Aluguel", supplier: "Imobiliária Costa",
  payment_method: "boleto", description: null, installment: null, installments: null,
};

describe("GET /api/cron/avisos-vencimento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "s3cr3t";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T11:00:00Z"));
    listTenantsForBillDigest.mockResolvedValue([TENANT]);
    listBills.mockResolvedValue([BILL_D3]);
    claimNotifications.mockImplementation(async (_t, _k, keys) => keys);
    notifyUpcomingBills.mockResolvedValue(undefined);
  });

  it("401 sem o secret", async () => {
    const { GET } = await import("@/app/api/cron/avisos-vencimento/route");
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(notifyUpcomingBills).not.toHaveBeenCalled();
  });

  it("401 com secret errado", async () => {
    const { GET } = await import("@/app/api/cron/avisos-vencimento/route");
    const res = await GET(req("errado"));
    expect(res.status).toBe(401);
  });

  it("envia o digest e reivindica antes", async () => {
    const { GET } = await import("@/app/api/cron/avisos-vencimento/route");

    const res = await GET(req("s3cr3t"));

    expect(res.status).toBe(200);
    expect(claimNotifications).toHaveBeenCalledWith(7, "vencimento", ["1:2026-08-16:d3"]);
    expect(notifyUpcomingBills).toHaveBeenCalledTimes(1);
  });

  it("não envia quando o claim volta vazio (já enviado hoje)", async () => {
    claimNotifications.mockResolvedValue([]);
    const { GET } = await import("@/app/api/cron/avisos-vencimento/route");

    await GET(req("s3cr3t"));

    expect(notifyUpcomingBills).not.toHaveBeenCalled();
  });

  it("não envia quando nenhuma conta se qualifica hoje", async () => {
    listBills.mockResolvedValue([{ ...BILL_D3, due_date: "2026-08-20" }]); // D-7
    const { GET } = await import("@/app/api/cron/avisos-vencimento/route");

    await GET(req("s3cr3t"));

    expect(claimNotifications).not.toHaveBeenCalled();
    expect(notifyUpcomingBills).not.toHaveBeenCalled();
  });

  it("ignora conta já paga", async () => {
    listBills.mockResolvedValue([{ ...BILL_D3, status: "pago" }]);
    const { GET } = await import("@/app/api/cron/avisos-vencimento/route");

    await GET(req("s3cr3t"));

    expect(notifyUpcomingBills).not.toHaveBeenCalled();
  });

  it("devolve o claim quando o envio falha", async () => {
    notifyUpcomingBills.mockRejectedValue(new Error("SMTP fora do ar"));
    const { GET } = await import("@/app/api/cron/avisos-vencimento/route");

    const res = await GET(req("s3cr3t"));

    expect(releaseNotifications).toHaveBeenCalledWith(7, "vencimento", ["1:2026-08-16:d3"]);
    expect(res.status).toBe(200); // um tenant com falha não derruba os demais
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/api/cron-avisos.test.ts`
Expected: FAIL — rota não existe

- [ ] **Step 4: Implementar a rota**

Criar `app/api/cron/avisos-vencimento/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import {
  claimNotifications, listBills, listTenantsForBillDigest, releaseNotifications,
} from "@/lib/db";
import { notifyUpcomingBills } from "@/lib/email/notify";
import { stageForToday } from "@/lib/recurring";
import type { BillLine } from "@/lib/email/templates";

const KIND = "vencimento";

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/**
 * Digest diário de contas a vencer. Agendado em vercel.json para 11:00
 * UTC = 08:00 BRT — cron da Vercel roda em UTC, e `0 8 * * *` entregaria
 * às 5 da manhã.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = todayISO();
  const tenants = await listTenantsForBillDigest();
  let sent = 0;

  for (const tenant of tenants) {
    try {
      const bills = await listBills(tenant.id, today);

      const due = bills
        .filter((b) => b.status !== "pago")
        .map((b) => ({ bill: b, stage: stageForToday(b.due_date, b.payment_method, today) }))
        .filter((x): x is { bill: (typeof bills)[number]; stage: string } => x.stage !== null);

      if (due.length === 0) continue;

      const keys = due.map((d) => `${d.bill.payable_id}:${d.bill.due_date}:${d.stage}`);
      const claimed = await claimNotifications(tenant.id, KIND, keys);
      if (claimed.length === 0) continue;

      const claimedSet = new Set(claimed);
      const lines: BillLine[] = due
        .filter((d) => claimedSet.has(`${d.bill.payable_id}:${d.bill.due_date}:${d.stage}`))
        .map((d) => ({
          label: [d.bill.category ?? d.bill.description ?? "Conta", d.bill.supplier]
            .filter(Boolean).join(" — "),
          dueDate: d.bill.due_date,
          amountCents: d.bill.amount_cents,
          status: d.bill.status === "atrasado" ? "atrasado"
                : d.bill.status === "vence_hoje" ? "vence_hoje"
                : "a_vencer",
        }));

      try {
        await notifyUpcomingBills(tenant, lines);
        sent++;
      } catch (err) {
        // Devolve o claim: sem isso, a falha de hoje viraria silêncio permanente.
        await releaseNotifications(tenant.id, KIND, claimed);
        console.error(`[cron] digest falhou para tenant ${tenant.id}:`, err);
      }
    } catch (err) {
      // Um tenant quebrado não pode impedir o aviso dos demais.
      console.error(`[cron] tenant ${tenant.id} falhou:`, err);
    }
  }

  return NextResponse.json({ ok: true, tenants: tenants.length, sent });
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/api/cron-avisos.test.ts`
Expected: PASS — 7 testes

- [ ] **Step 6: Declarar o cron**

Criar `vercel.json` na raiz:

```json
{
  "crons": [
    { "path": "/api/cron/avisos-vencimento", "schedule": "0 11 * * *" }
  ]
}
```

Definir `CRON_SECRET` na Vercel (Production e Preview):

```bash
vercel env add CRON_SECRET production
```

> A Vercel injeta o header `Authorization: Bearer $CRON_SECRET` automaticamente quando a env existe. Sem ela, a rota devolve 401 para todo mundo — inclusive para o próprio cron. **Configurar a env antes do deploy.**

- [ ] **Step 7: Typecheck, suíte completa e commit**

```bash
npx tsc --noEmit
npx vitest run
git add app/api/cron vercel.json lib/db/payables.ts tests/api/cron-avisos.test.ts
git commit -m "feat(financeiro): cron diário de avisos de vencimento"
```

---

## Task 9: Aba "Contas a pagar"

**Files:**
- Create: `components/admin/ContasAPagarTab.tsx`
- Modify: `app/admin/(protected)/financeiro/page.tsx`

**Interfaces:**
- Consumes: `listBills`, `listPayables` de `lib/db`; `BillWithPayable` de `lib/db/payables`
- Produces: componente `<ContasAPagarTab bills={...} payables={...} />`

- [ ] **Step 1: Criar o componente da lista**

Criar `components/admin/ContasAPagarTab.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import type { PayableRow } from "@/lib/schema";
import type { BillWithPayable } from "@/lib/db/payables";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/constants";
import { formatBRL } from "@/lib/money";
import { EmptyState } from "@/components/ui";

const GROUPS = [
  { id: "atrasado",  label: "Atrasadas",          tone: "text-danger" },
  { id: "vence_hoje", label: "Vencem hoje",       tone: "text-warning" },
  { id: "a_vencer",  label: "Próximas",           tone: "text-ink" },
  { id: "aguardando_conciliacao", label: "Débito automático — confirmar", tone: "text-n600" },
  { id: "pago",      label: "Pagas",              tone: "text-n500" },
] as const;

function brDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function ContasAPagarTab({
  bills, payables,
}: { bills: BillWithPayable[]; payables: PayableRow[] }) {
  const [rows] = useState(bills);

  const grouped = useMemo(
    () => GROUPS.map((g) => ({ ...g, items: rows.filter((b) => b.status === g.id) }))
                .filter((g) => g.items.length > 0),
    [rows],
  );

  const totalAberto = useMemo(
    () => rows.filter((b) => b.status !== "pago")
              .reduce((acc, b) => acc + (b.amount_cents ?? 0), 0),
    [rows],
  );

  if (payables.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock className="w-6 h-6" />}
        title="Nenhuma conta cadastrada"
        description="Cadastre aluguel, energia, impostos e outras contas para receber aviso antes do vencimento."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-n600">
          Em aberto na janela: <strong className="text-ink">{formatBRL(totalAberto)}</strong>
        </p>
      </div>

      {grouped.map((group) => (
        <section key={group.id} className="space-y-2">
          <h3 className={`text-eyebrow ${group.tone}`}>
            {group.label} · {group.items.length}
          </h3>
          <ul className="rounded-xl border border-n200 bg-white divide-y divide-n100">
            {group.items.map((b) => (
              <li key={`${b.payable_id}:${b.due_date}`} className="flex items-center gap-3 px-4 py-3">
                {b.status === "atrasado" && <AlertTriangle className="w-4 h-4 text-danger shrink-0" />}
                {b.status === "pago" && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink truncate">
                    {b.category ?? b.description ?? "Conta"}
                    {b.supplier && <span className="text-n500 font-normal"> · {b.supplier}</span>}
                  </p>
                  <p className="text-xs text-n500">
                    {brDate(b.due_date)}
                    {b.installment && ` · parcela ${b.installment} de ${b.installments}`}
                    {b.payment_method && ` · ${PAYMENT_METHOD_LABELS[b.payment_method as PaymentMethod] ?? b.payment_method}`}
                  </p>
                </div>
                <span className="font-medium text-ink whitespace-nowrap">
                  {formatBRL(b.status === "pago" ? (b.paid_amount_cents ?? 0) : (b.amount_cents ?? 0))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

> O botão "Registrar pagamento" e o "Nova conta" ficam inertes nesta task — a Task 10 os liga. A lista já é revisável sozinha.

- [ ] **Step 2: Ligar a aba na página**

Em `app/admin/(protected)/financeiro/page.tsx`:

1. Adicionar `"contas"` ao tipo `Tab` e a `TABS`:

```ts
type Tab = "resumo" | "veiculos" | "operacionais" | "contas";

const TABS: { id: Tab; label: string }[] = [
  { id: "resumo",       label: "Resumo" },
  { id: "veiculos",     label: "Por veículo" },
  { id: "operacionais", label: "Despesas operacionais" },
  { id: "contas",       label: "Contas a pagar" },
];
```

2. Importar `listBills`, `listPayables` de `@/lib/db` e `ContasAPagarTab`.

3. No corpo do componente, junto das outras buscas:

```ts
const todayISO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const [bills, payablesList] = tab === "contas"
  ? await Promise.all([listBills(tenant.id, todayISO), listPayables(tenant.id)])
  : [[], []];
```

4. Renderizar quando `tab === "contas"`:

```tsx
{tab === "contas" && <ContasAPagarTab bills={bills} payables={payablesList} />}
```

- [ ] **Step 3: Verificar no navegador**

```bash
npm run dev
```

Abrir `http://<slug>.localhost:3000/admin/financeiro?tab=contas`.

> Preview da Vercel **não serve** para verificar isto: `*.vercel.app` dá 404 em página com tenant, porque a resolução é por `Host`. Testar UI é local, em `<slug>.localhost:3000`.

Conferir: a aba aparece, o empty state aparece sem contas cadastradas, e nenhum erro no console.

- [ ] **Step 4: Typecheck e commit**

```bash
npx tsc --noEmit
git add components/admin/ContasAPagarTab.tsx "app/admin/(protected)/financeiro/page.tsx"
git commit -m "feat(financeiro): aba de contas a pagar"
```

---

## Task 10: Formulário da conta e modal de pagamento

**Files:**
- Create: `components/admin/PayableForm.tsx`
- Create: `components/admin/PayableRulesPanel.tsx`
- Create: `components/admin/RegistrarPagamentoModal.tsx`
- Modify: `components/admin/ContasAPagarTab.tsx`

**Interfaces:**
- Consumes: rotas `POST /api/payables`, `PATCH /api/payables/[id]`, `POST /api/payables/[id]/pagar`
- Produces:
  - `<PayableForm payable?: PayableRow onClose: () => void />`
  - `<PayableRulesPanel payables: PayableRow[] onClose: () => void />`
  - `<RegistrarPagamentoModal bill: BillWithPayable onClose: () => void />`

- [ ] **Step 1: Criar o formulário da conta**

Criar `components/admin/PayableForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PayableRow } from "@/lib/schema";
import {
  ALL_EXPENSE_CATEGORIES, MAX_INSTALLMENTS,
  PAYABLE_FREQUENCIES, PAYABLE_FREQUENCY_LABELS,
  PAYMENT_METHODS, PAYMENT_METHOD_LABELS,
} from "@/lib/constants";
import { displayToCents, centsToDisplay } from "@/lib/money";
import { Button, Field, Input, Modal, Select } from "@/components/ui";

export function PayableForm({
  payable, onClose,
}: { payable?: PayableRow; onClose: () => void }) {
  const router = useRouter();
  const isEdit = !!payable;

  const [form, setForm] = useState({
    type: payable?.type ?? "despesa_fixa",
    category: payable?.category ?? ALL_EXPENSE_CATEGORIES[0],
    description: payable?.description ?? "",
    supplier: payable?.supplier ?? "",
    amount: payable?.amount_cents ? centsToDisplay(payable.amount_cents) : "",
    frequency: payable?.frequency ?? "mensal",
    first_due_date: payable?.first_due_date ?? "",
    installments: payable?.installments ? String(payable.installments) : "",
    payment_method: payable?.payment_method ?? "boleto",
    notes: payable?.notes ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const parcelas = form.installments ? Number(form.installments) : null;
    if (parcelas !== null && (parcelas < 1 || parcelas > MAX_INSTALLMENTS)) {
      setError(`Parcelas deve ficar entre 1 e ${MAX_INSTALLMENTS}.`);
      setLoading(false);
      return;
    }

    const body = {
      type: form.type,
      category: form.category.trim() || null,
      description: form.description.trim() || null,
      supplier: form.supplier.trim() || null,
      amount_cents: form.amount ? displayToCents(form.amount) : null,
      frequency: form.frequency,
      first_due_date: form.first_due_date,
      installments: form.frequency === "unica" ? null : parcelas,
      payment_method: form.payment_method || null,
      notes: form.notes.trim() || null,
    };

    const res = await fetch(
      isEdit ? `/api/payables/${payable.id}` : "/api/payables",
      { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao salvar");
      setLoading(false);
      return;
    }

    onClose();
    router.refresh();
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? "Editar conta" : "Nova conta"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Categoria" required helperText="Escolha uma ou digite a sua.">
            {(f) => (
              <Input
                id={f.id} required list="cat-list"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="Aluguel"
              />
            )}
          </Field>
          <datalist id="cat-list">
            {ALL_EXPENSE_CATEGORIES.map((c) => <option key={c} value={c} />)}
          </datalist>

          <Field label="Fornecedor">
            {(f) => (
              <Input id={f.id} value={form.supplier}
                onChange={(e) => set("supplier", e.target.value)}
                placeholder="Imobiliária Costa" />
            )}
          </Field>
        </div>

        <Field label="Descrição">
          {(f) => (
            <Input id={f.id} value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Aluguel do galpão" />
          )}
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Tipo" required>
            {(f) => (
              <Select id={f.id} value={form.type}
                onValueChange={(v) => set("type", v)}
                options={[
                  { value: "despesa_fixa", label: "Despesa fixa" },
                  { value: "despesa_var",  label: "Despesa variável" },
                ]} />
            )}
          </Field>

          <Field label="Valor previsto" helperText="O valor real é digitado ao pagar.">
            {(f) => (
              <Input id={f.id} inputMode="decimal" value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="4.500,00" />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Frequência" required>
            {(f) => (
              <Select id={f.id} value={form.frequency}
                onValueChange={(v) => set("frequency", v)}
                options={PAYABLE_FREQUENCIES.map((s) => ({ value: s, label: PAYABLE_FREQUENCY_LABELS[s] }))} />
            )}
          </Field>

          <Field label="Primeiro vencimento" required>
            {(f) => (
              <Input id={f.id} type="date" required value={form.first_due_date}
                onChange={(e) => set("first_due_date", e.target.value)} />
            )}
          </Field>

          <Field label="Parcelas" helperText="Vazio = sem fim definido.">
            {(f) => (
              <Input id={f.id} type="number" min={1} max={MAX_INSTALLMENTS}
                disabled={form.frequency === "unica"}
                value={form.installments}
                onChange={(e) => set("installments", e.target.value)}
                placeholder="12" />
            )}
          </Field>
        </div>

        <Field label="Forma de pagamento"
          helperText="Débito automático recebe só o aviso de 3 dias antes — não entra em atrasadas.">
          {(f) => (
            <Select id={f.id} value={form.payment_method}
              onValueChange={(v) => set("payment_method", v)}
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} />
          )}
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>
            {isEdit ? "Salvar" : "Cadastrar conta"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 2: Criar o modal de pagamento**

Criar `components/admin/RegistrarPagamentoModal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BillWithPayable } from "@/lib/db/payables";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { centsToDisplay, displayToCents } from "@/lib/money";
import { Button, Field, Input, Modal, Select } from "@/components/ui";

export function RegistrarPagamentoModal({
  bill, onClose,
}: { bill: BillWithPayable; onClose: () => void }) {
  const router = useRouter();
  // pt-BR + timeZone explícito: `toISOString().slice(0,10)` devolveria a data
  // em UTC, e às 21h de Maceió já seria "amanhã" no campo.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

  const [amount, setAmount] = useState(bill.amount_cents ? centsToDisplay(bill.amount_cents) : "");
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState(bill.payment_method ?? "boleto");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cents = displayToCents(amount);
    if (cents <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch(`/api/payables/${bill.payable_id}/pagar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        due_date: bill.due_date,
        amount: cents,
        date,
        payment_method: method,
        notes: notes.trim() || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao registrar pagamento");
      setLoading(false);
      return;
    }

    onClose();
    router.refresh();
  }

  const [y, m, d] = bill.due_date.split("-");

  return (
    <Modal open onClose={onClose} title="Registrar pagamento">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <p className="text-sm text-n600">
          <strong className="text-ink">{bill.category ?? bill.description ?? "Conta"}</strong>
          {bill.supplier && ` · ${bill.supplier}`} · vence {d}/{m}/{y}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Valor pago" required helperText="Pré-preenchido com o previsto — ajuste se veio diferente.">
            {(f) => (
              <Input id={f.id} required inputMode="decimal" value={amount}
                onChange={(e) => setAmount(e.target.value)} />
            )}
          </Field>

          <Field label="Data do pagamento" required>
            {(f) => (
              <Input id={f.id} type="date" required value={date}
                onChange={(e) => setDate(e.target.value)} />
            )}
          </Field>
        </div>

        <Field label="Forma de pagamento">
          {(f) => (
            <Select id={f.id} value={method} onValueChange={setMethod}
              options={PAYMENT_METHODS.map((mm) => ({ value: mm, label: PAYMENT_METHOD_LABELS[mm] }))} />
          )}
        </Field>

        <Field label="Observação">
          {(f) => (
            <Input id={f.id} value={notes} onChange={(e) => setNotes(e.target.value)} />
          )}
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>Registrar pagamento</Button>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 3: Ligar os dois na aba**

Em `components/admin/ContasAPagarTab.tsx`:

1. Importar `PayableForm`, `RegistrarPagamentoModal`, `Button` de `@/components/ui` e `Plus` de `lucide-react`.
2. Adicionar o estado:

```tsx
const [novaConta, setNovaConta] = useState(false);
const [pagando, setPagando] = useState<BillWithPayable | null>(null);
```

3. Adicionar o botão no cabeçalho, ao lado do total em aberto:

```tsx
<Button leadingIcon={<Plus className="w-4 h-4" />} onClick={() => setNovaConta(true)}>
  Nova conta
</Button>
```

4. Dentro de cada `<li>`, antes do valor, quando `b.status !== "pago"`:

```tsx
<Button size="sm" variant="outline" onClick={() => setPagando(b)}>
  Registrar pagamento
</Button>
```

5. No fim do componente, antes do fechamento:

```tsx
{novaConta && <PayableForm onClose={() => setNovaConta(false)} />}
{pagando && <RegistrarPagamentoModal bill={pagando} onClose={() => setPagando(null)} />}
```

- [ ] **Step 4: Gestão das regras — editar e desativar**

O `PayableForm` já aceita `payable?` e faz `PATCH` quando recebe — falta a tela que passa isso. Criar `components/admin/PayableRulesPanel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import type { PayableRow } from "@/lib/schema";
import {
  PAYABLE_FREQUENCY_LABELS, PAYMENT_METHOD_LABELS,
  type PayableFrequency, type PaymentMethod,
} from "@/lib/constants";
import { formatBRL } from "@/lib/money";
import { Button, Modal, useConfirm } from "@/components/ui";
import { PayableForm } from "./PayableForm";

export function PayableRulesPanel({
  payables, onClose,
}: { payables: PayableRow[]; onClose: () => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PayableRow | null>(null);
  const { confirm, dialog } = useConfirm();

  async function handleDeactivate(p: PayableRow) {
    const ok = await confirm({
      title: `Desativar "${p.category ?? p.description ?? "conta"}"?`,
      description: "Ela para de gerar vencimentos daqui pra frente. Os pagamentos já registrados continuam no financeiro.",
      confirmLabel: "Desativar",
      danger: true,
    });
    if (!ok) return;

    await fetch(`/api/payables/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    router.refresh();
  }

  return (
    <Modal open onClose={onClose} title="Contas cadastradas">
      {dialog}
      <ul className="divide-y divide-n100">
        {payables.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink truncate">
                {p.category ?? p.description ?? "Conta"}
                {p.supplier && <span className="text-n500 font-normal"> · {p.supplier}</span>}
              </p>
              <p className="text-xs text-n500">
                {PAYABLE_FREQUENCY_LABELS[p.frequency as PayableFrequency] ?? p.frequency}
                {" · a partir de "}{p.first_due_date.split("-").reverse().join("/")}
                {p.installments && ` · ${p.installments}x`}
                {p.payment_method && ` · ${PAYMENT_METHOD_LABELS[p.payment_method as PaymentMethod] ?? p.payment_method}`}
              </p>
            </div>
            <span className="text-sm text-n600 whitespace-nowrap">
              {p.amount_cents ? formatBRL(p.amount_cents) : "—"}
            </span>
            <Button size="sm" variant="outline" onClick={() => setEditing(p)}
              leadingIcon={<Pencil className="w-3.5 h-3.5" />}>
              Editar
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleDeactivate(p)}
              className="text-danger hover:border-danger/40 hover:bg-danger/10">
              Desativar
            </Button>
          </li>
        ))}
      </ul>

      {editing && <PayableForm payable={editing} onClose={() => setEditing(null)} />}
    </Modal>
  );
}
```

> **Desativar, nunca excluir.** A regra não é deletável por decisão de design: apagar não pode evaporar o histórico de pagamentos nem os comprovantes anexados. O texto do diálogo diz isso ao lojista em vez de deixá-lo adivinhar.

Ligar na aba — em `ContasAPagarTab.tsx`, adicionar o estado e o botão ao lado de "Nova conta":

```tsx
const [gerindo, setGerindo] = useState(false);
```

```tsx
<Button variant="outline" onClick={() => setGerindo(true)}>Contas cadastradas</Button>
```

```tsx
{gerindo && <PayableRulesPanel payables={payables} onClose={() => setGerindo(false)} />}
```

- [ ] **Step 5: Verificar no navegador**

Em `<slug>.localhost:3000/admin/financeiro?tab=contas`:

0. Abrir "Contas cadastradas" → editar o valor previsto de uma conta → confirmar que a lista reflete. Desativar uma → seus vencimentos futuros somem da lista, e os já pagos permanecem.
1. Cadastrar "Aluguel, R$ 4.500, mensal, primeiro vencimento no dia 10 do mês que vem, boleto" → aparece em **Próximas**.
2. Cadastrar uma com vencimento no mês passado → aparece em **Atrasadas**.
3. Registrar o pagamento da atrasada com valor **diferente** do previsto → some de Atrasadas, aparece em **Pagas** com o valor digitado.
4. Conferir na aba **Despesas operacionais** que a transação apareceu lá também.
5. Tentar registrar o mesmo vencimento de novo → erro 409 "Este vencimento já foi pago."

- [ ] **Step 6: Typecheck e commit**

```bash
npx tsc --noEmit
npx vitest run
git add components/admin/PayableForm.tsx components/admin/RegistrarPagamentoModal.tsx components/admin/PayableRulesPanel.tsx components/admin/ContasAPagarTab.tsx
git commit -m "feat(financeiro): cadastro, edição e pagamento de contas"
```

---

## Task 11: Banner no dashboard e badge na sidebar

**Files:**
- Create: `components/admin/ContasVencendoBanner.tsx`
- Modify: `app/admin/(protected)/dashboard/page.tsx`
- Modify: `components/admin/AdminSidebar.tsx`

**Interfaces:**
- Consumes: `listBills` de `lib/db`
- Produces: `<ContasVencendoBanner bills={...} />`

- [ ] **Step 1: Criar o banner**

Criar `components/admin/ContasVencendoBanner.tsx`:

```tsx
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { BillWithPayable } from "@/lib/db/payables";
import { formatBRL } from "@/lib/money";

/**
 * Só aparece quando há algo acionável hoje: conta atrasada ou vencendo
 * hoje/amanhã. Banner permanente vira paisagem e para de ser lido.
 */
export function ContasVencendoBanner({ bills }: { bills: BillWithPayable[] }) {
  const urgentes = bills.filter(
    (b) => b.status === "atrasado" || b.status === "vence_hoje",
  );
  if (urgentes.length === 0) return null;

  const atrasadas = urgentes.filter((b) => b.status === "atrasado").length;
  const total = urgentes.reduce((acc, b) => acc + (b.amount_cents ?? 0), 0);

  return (
    <Link
      href="/admin/financeiro?tab=contas"
      className="flex items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 hover:bg-danger/10 transition-colors"
    >
      <AlertTriangle className="w-5 h-5 text-danger shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink text-sm">
          {atrasadas > 0
            ? `${atrasadas} conta${atrasadas > 1 ? "s" : ""} atrasada${atrasadas > 1 ? "s" : ""}`
            : `${urgentes.length} conta${urgentes.length > 1 ? "s" : ""} vencendo hoje`}
        </p>
        <p className="text-xs text-n600">
          {formatBRL(total)} · toque para ver e registrar o pagamento
        </p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Ligar no dashboard**

Em `app/admin/(protected)/dashboard/page.tsx`, importar `listBills` e `ContasVencendoBanner`, buscar as contas junto das demais consultas, e renderizar o banner no topo do conteúdo:

```tsx
const todayISO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const bills = await listBills(tenant.id, todayISO);
```

```tsx
<ContasVencendoBanner bills={bills} />
```

- [ ] **Step 3: Badge na sidebar**

Em `components/admin/AdminSidebar.tsx`, aceitar uma prop opcional `overdueCount?: number` na interface de props (junto de `tenantName`) e, no item "Financeiro", renderizar quando for maior que zero:

```tsx
{overdueCount ? (
  <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-danger text-white text-[11px] font-semibold">
    {overdueCount}
  </span>
) : null}
```

O consumidor é `app/admin/(protected)/layout.tsx:39`, que hoje renderiza `<AdminSidebar tenantName={tenant.name} />`. Buscar a contagem ali e passar adiante:

```tsx
import { countOverdue } from "@/lib/db";

const todayISO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const overdueCount = await countOverdue(tenant.id, todayISO);
```

```tsx
<AdminSidebar tenantName={tenant.name} overdueCount={overdueCount} />
```

> O layout envolve **todas** as páginas de `/admin`, então `countOverdue` roda em toda navegação. Ele é derivado de `listBills`, que são duas queries por chamada — aceitável no volume de uma revenda (uma dezena de regras), mas é o primeiro lugar a olhar se o painel ficar lento.

- [ ] **Step 4: Verificar no navegador**

Em `<slug>.localhost:3000/admin`:

1. Com uma conta atrasada → banner vermelho no topo e badge no item Financeiro.
2. Clicar no banner → cai na aba certa.
3. Pagar a conta → recarregar → banner e badge somem.
4. Sem nenhuma conta atrasada → nada aparece.

- [ ] **Step 5: Typecheck, suíte e commit**

```bash
npx tsc --noEmit
npx vitest run
git add components/admin "app/admin/(protected)/dashboard/page.tsx"
git commit -m "feat(financeiro): banner e badge de contas vencendo"
```

---

## Checklist de deploy

- [ ] `npm run db:generate` executado e o `.sql` revisado (nenhum `DROP` inesperado)
- [ ] Migration aplicada no **Neon** via `migrate.yml` — **antes** de mergear na `main`
- [ ] `CRON_SECRET` cadastrado na Vercel (Production **e** Preview)
- [ ] Confirmado o plano da Vercel: no Hobby, cron é 1×/dia com precisão de hora (pode sair 8h40)
- [ ] `npx vitest run` verde
- [ ] `npx tsc --noEmit` limpo
- [ ] UI verificada em `<slug>.localhost:3000` — preview `*.vercel.app` dá 404 em página com tenant
- [ ] Após o primeiro deploy: disparar o cron manualmente com o header `Authorization: Bearer $CRON_SECRET` e conferir que o e-mail chega uma vez só
