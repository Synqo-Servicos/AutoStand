# Registro de pagamentos e console financeiro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar cada pagamento de assinatura que o Mercado Pago cobra, e dar ao super-admin um console financeiro com caixa, recorrência e fila de NFS-e — com o contador operando essa fila num papel de escopo restrito.

**Architecture:** Uma tabela `payments` é a fonte da verdade, alimentada pelo webhook (que hoje descarta a notificação de cobrança) e recuperável por um botão de reconciliação. O console lê dela. O cálculo do Simples é módulo puro, testado desde já mas com o **resultado oculto** atrás de flag até validação contábil. O papel `contador` é isolado por **route group próprio**, não por checagem espalhada.

**Tech Stack:** Next.js App Router · Drizzle ORM + Postgres (Neon) · Zod · Vitest · SDK `mercadopago` · Tailwind + kit `components/ui`

**Spec:** `docs/superpowers/specs/2026-08-15-registro-de-pagamentos-e-console-financeiro-design.md`

## Global Constraints

- **Valores monetários são inteiros em centavos.** Exibição de dinheiro no financeiro usa `formatBRLFull` (preserva centavos), **nunca** `formatBRL` (arredonda de propósito, para telas de veículo).
- **Datas de competência são strings `YYYY-MM`**; datas de pagamento são `timestamp`. "Hoje" vem de `Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })`, nunca de `toISOString()`.
- **`withSuperAdmin` não muda de significado.** Continua `super_admin` e mais ninguém. Rotas do financeiro usam `withFinanceAccess`.
- **`payments.tenant_id` é `ON DELETE SET NULL`**, nunca cascade — registro fiscal não morre com o cliente.
- **O valor de imposto não aparece para `super_admin`** enquanto `FINANCE_TAX_VALIDATED` for falso. Aparece para `contador` (marcado como não validado) em qualquer estado da flag.
- **O rótulo do resultado do bloco Caixa é "líquido antes de imposto"**, nunca "líquido" sozinho.
- Testes: `npx vitest run <path>`. Typecheck: `npx tsc --noEmit`. Build: `npm run build`.
- Migrations: `npm run db:generate`; aplicar no Neon via `migrate.yml` **disparando a partir da branch que contém a migration**, antes de mergear.
- Há Postgres local em Docker (`autostand-pg`) e dev server na 3000 com seed. Rodar scripts que precisam de banco com `DATABASE_URL` explícito no ambiente — `.env.local` não é lido por script standalone.

### Sobre os passos de UI deste plano

Os passos de interface descrevem **comportamento e requisitos**, não JSX pronto — de propósito.

Nos dois planos anteriores deste projeto o JSX foi escrito sem conferir o kit e estava errado nas duas vezes (`EmptyState.icon` é `ComponentType`, não elemento; `Modal` não tem `<form>`, então `required` é inerte). Os implementadores acertaram justamente onde **leram `components/ui/` antes de escrever**.

Então: **leia a assinatura real do componente antes de usá-lo**, siga o padrão de uma tela existente do console (`app/superadmin/(panel)/cupons/page.tsx` é boa referência), e registre no relatório qualquer divergência que encontrar entre este plano e o kit. O kit é a fonte da verdade; este plano descreve o que a tela precisa fazer.

---

## File Structure

**Criar:**

| Arquivo | Responsabilidade |
|---|---|
| `lib/simples.ts` | Matemática do Simples: RBT12, proporcionalização, alíquota efetiva. **Puro**, sem banco |
| `lib/db/payments.ts` | Gravar pagamento (idempotente), listar por período, agregar caixa, fila fiscal |
| `lib/finance-access.ts` | `withFinanceAccess` e o predicado de papel usado por rota e por layout |
| `app/superadmin/(financeiro)/layout.tsx` | Gate de `super_admin` **ou** `contador` |
| `app/superadmin/(financeiro)/financeiro/page.tsx` | Console: caixa, imposto, recorrência, fila |
| `components/superadmin/CaixaCard.tsx` | Bloco de caixa |
| `components/superadmin/ImpostoCard.tsx` | Bloco de imposto, com flag e visibilidade por papel |
| `components/superadmin/RecorrenciaCard.tsx` | MRR, ativos por plano, inadimplentes |
| `components/superadmin/FilaFiscal.tsx` | Pendência fiscal + registrar número |
| `components/superadmin/ReconciliarButton.tsx` | Dispara a reconciliação, mostra a diferença antes |
| `app/api/superadmin/payments/[id]/nfse/route.ts` | Registra número da nota |
| `app/api/superadmin/payments/reconciliar/route.ts` | Compara com o MP e importa |

**Modificar:**

| Arquivo | O quê |
|---|---|
| `lib/schema.ts` | Tabela `payments` + tipos |
| `lib/constants.ts` | `PAYMENT_STATUSES`, `SIMPLES_ANEXOS` |
| `lib/db/index.ts` | `export * from "./payments"` |
| `lib/validation.ts` | `nfseInputSchema`, `reconcileInputSchema` |
| `app/api/webhooks/mercadopago/route.ts` | Tratar a notificação de cobrança |
| `components/superadmin/SuperAdminSidebar.tsx` | Item "Financeiro"; nav reduzida para `contador` |
| `scripts/seed.ts` | Usuário `contador` de teste |

---

## Task 1: Tabela `payments`

**Files:**
- Modify: `lib/schema.ts`, `lib/constants.ts`
- Create: `drizzle/000X_*.sql` (gerado), `tests/schema/payments.test.ts`

**Interfaces:**
- Produces: tabela `payments`; tipos `PaymentRow`, `NewPayment`; constantes `PAYMENT_STATUSES`, `SIMPLES_ANEXOS`

- [ ] **Step 1: Constantes**

Em `lib/constants.ts`, ao final:

```ts
// --- Financeiro da plataforma ---

/** Estado do pagamento. Estorno NUNCA vira delete — muda de status. */
export const PAYMENT_STATUSES = ["approved", "refunded", "chargeback"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * Anexo do Simples aplicável a serviço de TI. Depende do fator R
 * (folha ÷ receita bruta), que muda mês a mês — por isso é CONFIGURAÇÃO,
 * não constante de código. Ver FINANCE_ANEXO em lib/finance-config.ts.
 */
export const SIMPLES_ANEXOS = ["III", "V"] as const;
export type SimplesAnexo = (typeof SIMPLES_ANEXOS)[number];
```

- [ ] **Step 2: Teste de forma do schema**

Criar `tests/schema/payments.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { payments } from "@/lib/schema";
import { getTableColumns, getTableConfig } from "drizzle-orm/pg-core";

describe("tabela payments", () => {
  const cols = getTableColumns(payments);

  it("tem as colunas do spec", () => {
    expect(Object.keys(cols).sort()).toEqual([
      "coupon_id", "created_at", "fee_cents", "gross_cents", "id", "incomplete",
      "mp_payment_id", "mp_preapproval_id", "net_cents", "nfse_issued_at",
      "nfse_issued_by", "nfse_number", "paid_at", "plan", "status",
      "tenant_document", "tenant_id", "tenant_name",
    ].sort());
  });

  it("congela o pagador na linha — a nota diz quem pagou naquele dia", () => {
    expect(cols.tenant_name.notNull).toBe(true);
    expect(cols).toHaveProperty("tenant_document");
  });

  it("exige o essencial do dinheiro", () => {
    expect(cols.gross_cents.notNull).toBe(true);
    expect(cols.paid_at.notNull).toBe(true);
    expect(cols.status.notNull).toBe(true);
    expect(cols.mp_payment_id.notNull).toBe(true);
  });

  it("nasce sem nota emitida", () => {
    expect(cols.nfse_issued_at.notNull).toBe(false);
    expect(cols.nfse_number.notNull).toBe(false);
  });

  it("tenant_id é SET NULL — registro fiscal não morre com o cliente", () => {
    const fk = getTableConfig(payments).foreignKeys
      .find((f) => f.reference().foreignTable === undefined
        ? false
        : f.reference().columns.some((c) => c.name === "tenant_id"));
    expect(fk?.onDelete).toBe("set null");
  });
});
```

> O último teste é o que impede alguém de "padronizar" a FK para cascade — que é o padrão de todas as outras tabelas — e apagar histórico fiscal junto com um tenant.

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/schema/payments.test.ts`
Expected: FAIL — `payments is not exported`

- [ ] **Step 4: Tabela**

Em `lib/schema.ts`, após `sent_notifications`:

```ts
// --- Pagamentos da plataforma (assinaturas) ---

/**
 * Um pagamento de assinatura recebido. Fonte da verdade sobre receita.
 *
 * NÃO cascateia com o tenant: registro fiscal precisa sobreviver à saída
 * do cliente, e a nota tem que dizer quem era o pagador NAQUELE dia — por
 * isso nome e documento ficam copiados na linha, não lidos de `tenants`.
 */
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  tenant_id: integer("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  /** Snapshot do pagador no momento do pagamento. */
  tenant_name: text("tenant_name").notNull(),
  tenant_document: text("tenant_document"),
  /** Plano cobrado, snapshot — cliente muda de plano, nota emitida não muda. */
  plan: text("plan"),
  /** Id do pagamento no MP. Único = idempotência de webhook e reconciliação. */
  mp_payment_id: text("mp_payment_id").notNull(),
  mp_preapproval_id: text("mp_preapproval_id"),
  /** Três colunas, não uma conta: a taxa do MP muda com o tempo. */
  gross_cents: integer("gross_cents").notNull(),
  fee_cents: integer("fee_cents"),
  net_cents: integer("net_cents"),
  /** 'approved' | 'refunded' | 'chargeback' */
  status: text("status").notNull(),
  paid_at: timestamp("paid_at", { mode: "string" }).notNull(),
  coupon_id: integer("coupon_id").references(() => coupons.id, { onDelete: "set null" }),
  /** Nulos até a nota ser emitida — no portal (hoje) ou por API (camada 3). */
  nfse_issued_at: timestamp("nfse_issued_at", { mode: "string" }),
  nfse_number: text("nfse_number"),
  nfse_issued_by: integer("nfse_issued_by").references(() => users.id, { onDelete: "set null" }),
  /** Taxa não veio na resposta do MP: net = gross e o número fica marcado. */
  incomplete: boolean("incomplete").notNull().default(false),
  created_at: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => ({
  uniqMpPayment: uniqueIndex("uniq_payments_mp_id").on(table.mp_payment_id),
  byPaidAt: index("idx_payments_paid_at").on(table.paid_at),
  byTenant: index("idx_payments_tenant").on(table.tenant_id),
}));
```

E os tipos junto aos demais:

```ts
export type PaymentRow = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
```

- [ ] **Step 5: Ver passar, gerar migration, commitar**

```bash
npx vitest run tests/schema/payments.test.ts
npm run db:generate
```

Revisar o `.sql`: um `CREATE TABLE "payments"`, o índice único, e **nenhum `DROP`**. Se houver `DROP`, parar e investigar.

```bash
npx tsc --noEmit && npx vitest run
git add lib/schema.ts lib/constants.ts drizzle/ tests/schema/payments.test.ts
git commit -m "feat(financeiro): tabela de pagamentos da plataforma"
```

---

## Task 2: Camada de dados

**Files:**
- Create: `lib/db/payments.ts`, `tests/lib/db/payments.test.ts`
- Modify: `lib/db/index.ts`

**Interfaces:**
- Consumes: `payments` da Task 1
- Produces:
  - `recordPayment(input: RecordPaymentInput): Promise<{ created: boolean }>`
  - `listPaymentsByPeriod(competencia: string): Promise<PaymentRow[]>` — `competencia` é `YYYY-MM`
  - `sumCaixa(competencia: string): Promise<{ gross: number; fee: number; netBeforeTax: number }>`
  - `listPendingNfse(): Promise<PaymentRow[]>`
  - `registerNfse(paymentId: number, number: string, userId: number): Promise<PaymentRow | null>`
  - `sumGrossBetween(fromISO: string, toISO: string): Promise<number>` — base do RBT12
  - `updatePaymentStatus(mpPaymentId: string, status: string): Promise<PaymentRow | null>`
  - `interface RecordPaymentInput { tenant_id: number | null; tenant_name: string; tenant_document: string | null; plan: string | null; mp_payment_id: string; mp_preapproval_id: string | null; gross_cents: number; fee_cents: number | null; net_cents: number | null; status: string; paid_at: string; coupon_id: number | null; incomplete: boolean }`

> **`updatePaymentStatus` existe por causa do estorno.** `recordPayment` usa `onConflictDoNothing`, então uma notificação de estorno para um `mp_payment_id` que já existe seria **descartada** — o pagamento continuaria contado como receita para sempre. O spec diz que estorno muda o status, e é esta função que cumpre isso. Ela é idempotente: aplicar duas vezes dá o mesmo resultado.

- [ ] **Step 1: Teste**

Criar `tests/lib/db/payments.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const insertValues = vi.fn();
const insertReturning = vi.fn();
const selectRows = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {
    insert: () => ({
      values: (v: unknown) => { insertValues(v); return {
        onConflictDoNothing: () => ({ returning: () => insertReturning() }),
      }; },
    }),
    select: () => ({ from: () => ({ where: () => ({ orderBy: () => selectRows() }) }) }),
  },
  client: {},
}));

describe("recordPayment", () => {
  beforeEach(() => { vi.clearAllMocks(); insertReturning.mockReset(); });

  it("grava e reporta created quando a linha entrou", async () => {
    insertReturning.mockResolvedValueOnce([{ id: 1 }]);
    const { recordPayment } = await import("@/lib/db/payments");
    const r = await recordPayment({
      tenant_id: 7, tenant_name: "Auto Brasil", tenant_document: "12345678000199",
      plan: "pro", mp_payment_id: "mp-1", mp_preapproval_id: "pre-1",
      gross_cents: 24990, fee_cents: 1200, net_cents: 23790,
      status: "approved", paid_at: "2026-08-15T12:00:00Z", coupon_id: null, incomplete: false,
    });
    expect(r.created).toBe(true);
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ mp_payment_id: "mp-1" }));
  });

  it("é idempotente — segunda vez não cria", async () => {
    insertReturning.mockResolvedValueOnce([]);
    const { recordPayment } = await import("@/lib/db/payments");
    const r = await recordPayment({
      tenant_id: 7, tenant_name: "Auto Brasil", tenant_document: null, plan: "pro",
      mp_payment_id: "mp-1", mp_preapproval_id: null,
      gross_cents: 24990, fee_cents: null, net_cents: null,
      status: "approved", paid_at: "2026-08-15T12:00:00Z", coupon_id: null, incomplete: true,
    });
    expect(r.created).toBe(false);
  });

  it("descarta campo malicioso no input — só a allowlist é gravada", async () => {
    insertReturning.mockResolvedValueOnce([{ id: 1 }]);
    const { recordPayment } = await import("@/lib/db/payments");
    await recordPayment({
      tenant_id: 7, tenant_name: "X", tenant_document: null, plan: null,
      mp_payment_id: "mp-2", mp_preapproval_id: null,
      gross_cents: 100, fee_cents: null, net_cents: null,
      status: "approved", paid_at: "2026-08-15T12:00:00Z", coupon_id: null, incomplete: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...( { nfse_number: "FALSO", id: 999 } as any ),
    });
    const arg = insertValues.mock.calls[0][0];
    expect(arg).not.toHaveProperty("nfse_number");
    expect(arg).not.toHaveProperty("id");
  });
});
```

> O terceiro teste existe porque este projeto já teve dois mass-assignments (`createPayable`, `addPayableAttachment`). A allowlist entra desde o começo, não como correção depois.

- [ ] **Step 2: Ver falhar** — `npx vitest run tests/lib/db/payments.test.ts` → não resolve o módulo

- [ ] **Step 3: Implementar**

Criar `lib/db/payments.ts`:

```ts
import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "./client";
import { payments, type PaymentRow } from "@/lib/schema";

export interface RecordPaymentInput {
  tenant_id: number | null;
  tenant_name: string;
  tenant_document: string | null;
  plan: string | null;
  mp_payment_id: string;
  mp_preapproval_id: string | null;
  gross_cents: number;
  fee_cents: number | null;
  net_cents: number | null;
  status: string;
  paid_at: string;
  coupon_id: number | null;
  incomplete: boolean;
}

/** Allowlist do que pode ser gravado. Id e campos de NFS-e nunca vêm do input. */
const RECORD_FIELDS = [
  "tenant_id", "tenant_name", "tenant_document", "plan",
  "mp_payment_id", "mp_preapproval_id",
  "gross_cents", "fee_cents", "net_cents",
  "status", "paid_at", "coupon_id", "incomplete",
] as const;

function pickRecordFields(input: RecordPaymentInput): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const k of RECORD_FIELDS) {
    if (k in input) safe[k] = (input as unknown as Record<string, unknown>)[k];
  }
  return safe;
}

/**
 * Grava um pagamento. Idempotente pelo índice único em `mp_payment_id` —
 * webhook repetido e reconciliação usam o mesmo caminho sem duplicar.
 */
export async function recordPayment(input: RecordPaymentInput): Promise<{ created: boolean }> {
  const rows = await db
    .insert(payments)
    .values(pickRecordFields(input) as never)
    .onConflictDoNothing()
    .returning({ id: payments.id });
  return { created: rows.length > 0 };
}

/** Limites [início, fim) de uma competência 'YYYY-MM', em ISO. */
export function periodBounds(competencia: string): { from: string; to: string } {
  const [y, m] = competencia.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const to = new Date(Date.UTC(y, m, 1)).toISOString();
  return { from, to };
}

export async function listPaymentsByPeriod(competencia: string): Promise<PaymentRow[]> {
  const { from, to } = periodBounds(competencia);
  return db.select().from(payments)
    .where(and(gte(payments.paid_at, from), lte(payments.paid_at, to)))
    .orderBy(desc(payments.paid_at));
}

/** Caixa do período. Estorno e chargeback não entram. */
export async function sumCaixa(competencia: string) {
  const rows = await listPaymentsByPeriod(competencia);
  const ok = rows.filter((r) => r.status === "approved");
  const gross = ok.reduce((a, r) => a + r.gross_cents, 0);
  const fee = ok.reduce((a, r) => a + (r.fee_cents ?? 0), 0);
  return { gross, fee, netBeforeTax: gross - fee };
}

export async function listPendingNfse(): Promise<PaymentRow[]> {
  return db.select().from(payments)
    .where(and(eq(payments.status, "approved"), isNull(payments.nfse_issued_at)))
    .orderBy(desc(payments.paid_at));
}

export async function registerNfse(
  paymentId: number, numero: string, userId: number,
): Promise<PaymentRow | null> {
  const [row] = await db.update(payments)
    .set({
      nfse_number: numero,
      nfse_issued_at: sql`CURRENT_TIMESTAMP`,
      nfse_issued_by: userId,
    })
    .where(eq(payments.id, paymentId))
    .returning();
  return row ?? null;
}

/** Base do RBT12: bruto aprovado num intervalo. */
export async function sumGrossBetween(fromISO: string, toISO: string): Promise<number> {
  const rows = await db.select({ gross: payments.gross_cents, status: payments.status })
    .from(payments)
    .where(and(gte(payments.paid_at, fromISO), lte(payments.paid_at, toISO)))
    .orderBy(payments.paid_at);
  return rows.filter((r) => r.status === "approved").reduce((a, r) => a + r.gross, 0);
}
```

Em `lib/db/index.ts`: `export * from "./payments";`

- [ ] **Step 4: Ver passar e commitar**

```bash
npx vitest run tests/lib/db/payments.test.ts
npx tsc --noEmit && npx vitest run
git add lib/db/payments.ts lib/db/index.ts tests/lib/db/payments.test.ts
git commit -m "feat(financeiro): camada de dados dos pagamentos"
```

---

## Task 3: Webhook passa a registrar o pagamento

**Files:**
- Modify: `app/api/webhooks/mercadopago/route.ts`
- Test: `tests/api/webhook-pagamento.test.ts`

**Interfaces:**
- Consumes: `recordPayment` da Task 2
- Produces: nenhuma nova API pública

- [ ] **Step 1: Descobrir a forma real da notificação**

**Não presuma o tipo.** O repo tem um fluxo de diagnóstico que cria pagamento real de R$ 1 (`app/api/superadmin/fluxo-teste/`), e ele já foi usado para validar o webhook em produção.

Antes de escrever a implementação:
1. Consulte a documentação atual do Mercado Pago sobre notificações de assinatura (`preapproval`) e qual `type`/`topic` chega quando a cobrança recorrente é feita.
2. Registre no relatório o tipo exato e o formato do `data.id`.

Se a documentação for ambígua, adicione **temporariamente** um `console.log(JSON.stringify(body))` no início do handler, dispare o fluxo de diagnóstico, observe o payload real, e **remova o log** antes de commitar.

- [ ] **Step 2: Teste**

Criar `tests/api/webhook-pagamento.test.ts`. Substitua `TIPO_DE_PAGAMENTO` pelo valor descoberto no Step 1:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const recordPayment = vi.fn();
const getTenantById = vi.fn();
const setTenantSubscriptionState = vi.fn();
const paymentGet = vi.fn();

vi.mock("@/lib/db", () => ({ recordPayment, getTenantById, setTenantSubscriptionState }));
vi.mock("@/lib/email/notify", () => ({ notifyPaymentStatus: vi.fn() }));
vi.mock("mercadopago", () => ({
  default: class { constructor() {} },
  MercadoPagoConfig: class { constructor() {} },
  PreApproval: class { get = vi.fn() },
  Payment: class { get = paymentGet },
}));

function req(body: unknown) {
  return {
    json: async () => body,
    headers: { get: () => "" },
  } as never;
}

describe("webhook — notificação de cobrança", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MERCADOPAGO_WEBHOOK_SECRET = "s";
    getTenantById.mockResolvedValue({ id: 7, name: "Auto Brasil", document: "123", plan: "pro", coupon_id: null });
    paymentGet.mockResolvedValue({
      id: 999, status: "approved", transaction_amount: 249.9,
      date_approved: "2026-08-15T12:00:00.000-03:00",
      external_reference: "7",
      fee_details: [{ amount: 12.0 }],
    });
    recordPayment.mockResolvedValue({ created: true });
  });

  it("grava o pagamento com bruto, taxa e líquido em centavos", async () => {
    const { POST } = await import("@/app/api/webhooks/mercadopago/route");
    await POST(req({ type: "TIPO_DE_PAGAMENTO", data: { id: "999" } }));
    expect(recordPayment).toHaveBeenCalledWith(expect.objectContaining({
      mp_payment_id: "999",
      gross_cents: 24990,
      fee_cents: 1200,
      net_cents: 23790,
      status: "approved",
      incomplete: false,
    }));
  });

  it("congela nome e documento do pagador na linha", async () => {
    const { POST } = await import("@/app/api/webhooks/mercadopago/route");
    await POST(req({ type: "TIPO_DE_PAGAMENTO", data: { id: "999" } }));
    expect(recordPayment).toHaveBeenCalledWith(expect.objectContaining({
      tenant_name: "Auto Brasil",
      tenant_document: "123",
    }));
  });

  it("taxa ausente: net = gross e marca incomplete", async () => {
    paymentGet.mockResolvedValueOnce({
      id: 998, status: "approved", transaction_amount: 249.9,
      date_approved: "2026-08-15T12:00:00.000-03:00", external_reference: "7",
    });
    const { POST } = await import("@/app/api/webhooks/mercadopago/route");
    await POST(req({ type: "TIPO_DE_PAGAMENTO", data: { id: "998" } }));
    expect(recordPayment).toHaveBeenCalledWith(expect.objectContaining({
      fee_cents: null, net_cents: 24990, incomplete: true,
    }));
  });

  it("falha ao buscar no MP não grava linha pela metade", async () => {
    paymentGet.mockRejectedValueOnce(new Error("MP fora do ar"));
    const { POST } = await import("@/app/api/webhooks/mercadopago/route");
    const res = await POST(req({ type: "TIPO_DE_PAGAMENTO", data: { id: "997" } }));
    expect(recordPayment).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("notificação de preapproval continua não gravando pagamento", async () => {
    const { POST } = await import("@/app/api/webhooks/mercadopago/route");
    await POST(req({ type: "preapproval", data: { id: "pre-1" } }));
    expect(recordPayment).not.toHaveBeenCalled();
  });

  it("estorno de pagamento já registrado ATUALIZA o status, não é descartado", async () => {
    recordPayment.mockResolvedValueOnce({ created: false });
    paymentGet.mockResolvedValueOnce({
      id: 999, status: "refunded", transaction_amount: 249.9,
      date_approved: "2026-08-15T12:00:00.000-03:00", external_reference: "7",
      fee_details: [{ amount: 12.0 }],
    });
    const { POST } = await import("@/app/api/webhooks/mercadopago/route");
    await POST(req({ type: "TIPO_DE_PAGAMENTO", data: { id: "999" } }));
    expect(updatePaymentStatus).toHaveBeenCalledWith("999", "refunded");
  });
});
```

Acrescente `updatePaymentStatus` ao mock de `@/lib/db` no topo do arquivo.

> Sem este caso, um estorno seria silenciosamente ignorado — `onConflictDoNothing` descarta a segunda notificação — e o pagamento contaria como receita para sempre. É o tipo de erro que só aparece quando o dinheiro já foi devolvido e o console diz que não foi.

> O teste da falha do MP devolve **200**: reprocessar é trabalho da reconciliação, e devolver erro faria o MP reenviar indefinidamente.

- [ ] **Step 3: Ver falhar, implementar, ver passar**

No handler, **antes** do `if (body.type !== "preapproval")`, tratar o tipo de pagamento: buscar via `new Payment(getMpClient()).get({ id: dataId })`, converter reais→centavos com `Math.round(x * 100)`, somar `fee_details[].amount` para a taxa, resolver o tenant por `external_reference`, e chamar `recordPayment`. Envolver a busca em `try/catch` que loga e devolve 200 sem gravar.

- [ ] **Step 4: Commit**

```bash
npx tsc --noEmit && npx vitest run
git add app/api/webhooks/mercadopago/route.ts tests/api/webhook-pagamento.test.ts
git commit -m "feat(financeiro): webhook registra o pagamento da assinatura"
```

---

## Task 4: Papel `contador` e isolamento por route group

**Files:**
- Create: `lib/finance-access.ts`, `app/superadmin/(financeiro)/layout.tsx`, `tests/lib/finance-access.test.ts`
- Modify: `lib/constants.ts`, `components/superadmin/SuperAdminSidebar.tsx`, `scripts/seed.ts`

**Interfaces:**
- Produces: `hasFinanceAccess(role: string | undefined): boolean`; `withFinanceAccess(handler)`; role `contador`

- [ ] **Step 1: Entender por que o isolamento é estrutural**

`app/superadmin/(panel)/layout.tsx` gateia **todas** as páginas do console num único `role !== "super_admin"`. Adicionar `contador` ali abriria tenants, cupons, parceiros e diagnóstico para ele.

A solução é **route group próprio**: o financeiro sai de `(panel)` e vai para `(financeiro)`, com layout próprio. Assim:

- `(panel)` continua `super_admin` e mais ninguém — **arquivo não muda**
- página nova criada em `(panel)` **já nasce fechada** ao contador
- o modo de falha por esquecimento é negar acesso, não conceder

- [ ] **Step 2: Teste do predicado e do wrapper**

Criar `tests/lib/finance-access.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { hasFinanceAccess } from "@/lib/finance-access";

describe("hasFinanceAccess", () => {
  it("aceita super_admin e contador", () => {
    expect(hasFinanceAccess("super_admin")).toBe(true);
    expect(hasFinanceAccess("contador")).toBe(true);
  });
  it("nega tenant_admin, indefinido e papel inventado", () => {
    expect(hasFinanceAccess("tenant_admin")).toBe(false);
    expect(hasFinanceAccess(undefined)).toBe(false);
    expect(hasFinanceAccess("admin")).toBe(false);
  });
});

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

describe("withFinanceAccess", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deixa o contador passar", async () => {
    auth.mockResolvedValue({ user: { id: "3", role: "contador" } });
    const { withFinanceAccess } = await import("@/lib/finance-access");
    const h = withFinanceAccess(async (_r, ctx) =>
      new Response(JSON.stringify({ userId: ctx.userId }), { status: 200 }));
    const res = await h({} as never, { params: Promise.resolve({}) } as never);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ userId: 3 });
  });

  it("nega tenant_admin", async () => {
    auth.mockResolvedValue({ user: { id: "9", role: "tenant_admin" } });
    const { withFinanceAccess } = await import("@/lib/finance-access");
    const h = withFinanceAccess(async () => new Response("ok"));
    const res = await h({} as never, { params: Promise.resolve({}) } as never);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: Teste que prova o deny por padrão**

No mesmo arquivo:

```ts
describe("withSuperAdmin não afrouxa", () => {
  beforeEach(() => vi.clearAllMocks());

  it("continua negando o contador — é o que garante que página nova nasça fechada", async () => {
    auth.mockResolvedValue({ user: { id: "3", role: "contador" } });
    const { withSuperAdmin } = await import("@/lib/api");
    const h = withSuperAdmin(async () => new Response("ok"));
    const res = await h({} as never, { params: Promise.resolve({}) } as never);
    expect(res.status).toBe(401);
  });
});
```

> Este é o teste mais importante da task. Ele falha no dia em que alguém "resolver" um chamado adicionando `|| role === "contador"` ao wrapper padrão.

- [ ] **Step 4: Implementar**

Adicionar `"contador"` aos papéis conhecidos em `lib/constants.ts`. Criar `lib/finance-access.ts` com `hasFinanceAccess` e `withFinanceAccess` — este último espelhando `withSuperAdmin` (`lib/api.ts:60-80`) e trocando só o predicado de papel.

Criar `app/superadmin/(financeiro)/layout.tsx` copiando a estrutura de `(panel)/layout.tsx`, com `if (!hasFinanceAccess(session?.user?.role)) redirect("/superadmin/login")` e a mesma checagem de `must_change_password`.

Em `SuperAdminSidebar.tsx`: adicionar `{ href: "/superadmin/financeiro", label: "Financeiro", icon: Wallet }` e receber uma prop `role` que reduz `NAV` a apenas o item de financeiro quando o papel for `contador`.

Em `scripts/seed.ts`: criar um usuário `contador@plataforma.com` com papel `contador`, e imprimir junto dos demais acessos de demo.

- [ ] **Step 5: Verificar e commitar**

```bash
npx vitest run tests/lib/finance-access.test.ts
npx tsc --noEmit && npx vitest run && npm run build
git add lib/finance-access.ts lib/constants.ts components/superadmin/SuperAdminSidebar.tsx \
        scripts/seed.ts "app/superadmin/(financeiro)/layout.tsx" tests/lib/finance-access.test.ts
git commit -m "feat(console): papel contador isolado em route group próprio"
```

---

## Task 5: Console — caixa e recorrência

**Files:**
- Create: `app/superadmin/(financeiro)/financeiro/page.tsx`, `components/superadmin/CaixaCard.tsx`, `components/superadmin/RecorrenciaCard.tsx`
- Modify: `lib/db/payments.ts` (agregados de recorrência)

**Interfaces:**
- Consumes: `sumCaixa`, `listPaymentsByPeriod` da Task 2; `hasFinanceAccess` da Task 4
- Produces: `getRecorrencia(): Promise<{ mrrCents: number; ativosPorPlano: Record<string, number>; inadimplentes: number }>`

- [ ] **Step 1: Agregado de recorrência**

Em `lib/db/payments.ts`, uma função que lê `tenants` (não `payments` — recorrência é sobre quem assina, não sobre o que entrou): conta ativos por plano usando `subscription_status = 'active'`, soma o preço de tabela de cada plano para o MRR, e conta `past_due` como inadimplentes.

- [ ] **Step 2: Página e cartões**

`page.tsx` é server component com `export const dynamic = "force-dynamic"`, lê a competência de `searchParams` (default: mês corrente em `America/Sao_Paulo`), e renderiza os cartões.

`CaixaCard` exibe bruto, taxa do MP e o resultado — **rotulado "Líquido antes de imposto"**, com `formatBRLFull`.

> O rótulo é requisito do spec, não estilo. Com o bloco de imposto desligado, "líquido" sozinho seria lido como dinheiro disponível — exatamente o erro que esconder o imposto existe para evitar.

- [ ] **Step 3: Verificar no navegador**

Subir `npm run dev`, entrar em `http://console.localhost:3000/superadmin/financeiro` como super-admin (`super@plataforma.com`), e depois como o contador do seed. Confirmar que o contador **não** consegue abrir `/superadmin/tenants`.

> O console só existe no subdomínio `console.` — `localhost:3000/superadmin` dá 404 por design (fence de host em `app/superadmin/layout.tsx`).

- [ ] **Step 4: Commit**

---

## Task 6: Fila fiscal

**Files:**
- Create: `components/superadmin/FilaFiscal.tsx`, `app/api/superadmin/payments/[id]/nfse/route.ts`, `tests/api/payments-nfse.test.ts`
- Modify: `lib/validation.ts`, `app/superadmin/(financeiro)/financeiro/page.tsx`

**Interfaces:**
- Consumes: `listPendingNfse`, `registerNfse` da Task 2; `withFinanceAccess` da Task 4
- Produces: rota `POST /api/superadmin/payments/[id]/nfse`

- [ ] **Step 1: Schema**

Em `lib/validation.ts`: `nfseInputSchema = z.object({ numero: z.string().trim().min(1).max(60) })`.

- [ ] **Step 2: Teste da rota**

Cobrir: contador consegue registrar; `super_admin` também; `tenant_admin` recebe 401; número vazio dá 400; registrar grava `nfse_issued_by` com o id da sessão. Use o padrão de mock de `tests/api/payables.test.ts` (mockar `@/lib/db` e `@/lib/auth`, usar o wrapper real).

- [ ] **Step 3: Rota e UI**

Rota com `withFinanceAccess`, chamando `registerNfse(id, numero, ctx.userId)`.

`FilaFiscal` lista os pendentes com os dados de emissão (pagador, CNPJ, valor, competência) e um campo para o número. É a tela de trabalho do contador.

- [ ] **Step 4: Commit**

---

## Task 7: Matemática do Simples

**Files:**
- Create: `lib/simples.ts`, `lib/simples-tabela.ts`, `tests/lib/simples.test.ts`

**Interfaces:**
- Produces:
  - `rbt12(monthlyGross: number[], mesesEmOperacao: number): number`
  - `aliquotaEfetiva(rbt12Cents: number, anexo: SimplesAnexo): { nominal: number; deduzir: number; efetiva: number; faixa: number }`
  - `dasEstimado(receitaMesCents: number, aliquotaEfetiva: number): number`

- [ ] **Step 1: Tabela em arquivo de dados**

`lib/simples-tabela.ts` com as faixas de Anexo III e V — alíquota nominal e parcela a deduzir por faixa —, **com a fonte citada e a data de vigência no topo do arquivo**.

> Esta tabela não ganha teste que repita seus valores: vem de lei, muda por decreto, e um teste que copia a constante só prova que ela foi digitada duas vezes.

- [ ] **Step 2: Teste do cálculo**

Cobrir: alíquota efetiva em cada faixa; virada de faixa; **proporcionalização de empresa nova** (a SYNQO abriu em 02/06/2026 e não tem 12 meses — a receita acumulada é proporcionalizada, não somada direto, e somar direto joga a alíquota na faixa errada); e `dasEstimado`.

- [ ] **Step 3: Implementar, ver passar, commitar**

Módulo **puro**: sem banco, sem `new Date()` interno — mês de referência entra como parâmetro.

---

## Task 8: Bloco de imposto, com flag e visibilidade por papel

**Files:**
- Create: `components/superadmin/ImpostoCard.tsx`, `lib/finance-config.ts`
- Modify: `app/superadmin/(financeiro)/financeiro/page.tsx`
- Test: `tests/lib/finance-config.test.ts`

**Interfaces:**
- Consumes: `aliquotaEfetiva`, `rbt12`, `dasEstimado` da Task 7; `sumGrossBetween` da Task 2
- Produces: `FINANCE_ANEXO`, `FINANCE_TAX_VALIDATED`, `showsTaxValue(role: string | undefined): boolean`

- [ ] **Step 1: Configuração**

`lib/finance-config.ts` lê `FINANCE_ANEXO` (default `"III"`) e `FINANCE_TAX_VALIDATED` (default `false`) do ambiente, e expõe:

```ts
/**
 * O valor de imposto some para quem tomaria decisão com ele, e aparece
 * para quem tem qualificação para julgá-lo. O contador vê o cálculo ainda
 * não validado — é ele quem valida; o super-admin só vê depois do aval.
 */
export function showsTaxValue(role: string | undefined): boolean {
  if (role === "contador") return true;
  return FINANCE_TAX_VALIDATED;
}
```

- [ ] **Step 2: Teste dos quatro cruzamentos**

`super_admin` × flag off → false; `super_admin` × flag on → true; `contador` × flag off → true; `contador` × flag on → true.

- [ ] **Step 3: Cartão**

Com `showsTaxValue` falso: mostra o estado ("aguardando validação contábil") e **os insumos** — RBT12 apurado, anexo configurado e desde quando. Sem DAS, sem alíquota.

Com verdadeiro: mostra também DAS **estimado** (a palavra aparece na tela), alíquota efetiva e vencimento. Para o contador com a flag desligada, marcado como não validado.

- [ ] **Step 4: Commit**

---

## Task 9: Reconciliação

**Files:**
- Create: `app/api/superadmin/payments/reconciliar/route.ts`, `components/superadmin/ReconciliarButton.tsx`, `tests/api/payments-reconciliar.test.ts`
- Modify: `lib/validation.ts`

**Interfaces:**
- Consumes: `recordPayment`, `listPaymentsByPeriod` da Task 2; `withFinanceAccess` da Task 4

- [ ] **Step 1: Confirmar a API de busca do MP**

Como no Step 1 da Task 3: **consulte a documentação** do Mercado Pago sobre busca de pagamentos por período/assinatura antes de escrever. Registre no relatório o endpoint e os parâmetros usados.

- [ ] **Step 2: Duas etapas, não uma**

A rota aceita `?dry=true` e devolve **a diferença sem gravar**; sem o parâmetro, importa.

> Webhook perdido é informação sobre o sistema, não só uma linha faltando. Importar em silêncio esconderia que o caminho principal falhou.

- [ ] **Step 3: Teste**

Cobrir: `dry` não grava; importação é idempotente (segunda execução não duplica); pagamento que já existe localmente não aparece como diferença; `tenant_admin` recebe 401.

- [ ] **Step 4: UI e commit**

Botão que roda o `dry`, mostra o que falta, e pede confirmação antes de importar.

---

## Checklist de deploy

- [ ] `npm run db:generate` rodado e o `.sql` revisado — nenhum `DROP`
- [ ] Migration aplicada no Neon via `migrate.yml`, **disparada a partir desta branch**, antes do merge
- [ ] `FINANCE_ANEXO` e `FINANCE_TAX_VALIDATED` cadastrados na Vercel (Production)
- [ ] Usuário `contador` criado em produção com senha provisória (`must_change_password`)
- [ ] `npx vitest run` verde, `npx tsc --noEmit` limpo, `npm run build` compilando
- [ ] Console verificado em `console.localhost:3000` com os **dois** papéis — e confirmado que o contador recebe 404/redirect em `/superadmin/tenants`
