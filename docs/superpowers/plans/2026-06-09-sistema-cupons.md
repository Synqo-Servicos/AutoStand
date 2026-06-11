# Sistema de Cupons — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar sistema de cupons de desconto para o fluxo de cadastro `/assinar`, com criação/gestão pelo superadmin e integração com planos Mercado Pago on-the-fly.

**Architecture:** A tabela `coupons` é plataforma-global (sem `tenant_id`). Cupons são validados publicamente em `/api/cupons/validate`. No momento do cadastro, se houver cupom válido, `createCheckoutSession` cria um plano MP com preço reduzido on-the-fly via `PreApprovalPlan.create()`. O cupom é marcado como usado no momento do submit (não após pagamento) para evitar reuso por abandono.

**Tech Stack:** Next.js App Router, Drizzle ORM + Turso (SQLite), MercadoPago SDK v3 (`PreApprovalPlan`), Vitest.

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `lib/schema.ts` | Modificar | Adicionar tabela `coupons` + coluna `tenants.coupon_id` |
| `drizzle/0013_coupons.sql` | Criar | Migration SQL correspondente |
| `lib/db/coupons.ts` | Criar | CRUD: `listCoupons`, `getCouponByCode`, `getCouponByCodeRaw`, `createCoupon`, `incrementCouponUse` |
| `lib/db/index.ts` | Modificar | Re-exportar `lib/db/coupons.ts` |
| `lib/db/tenants.ts` | Modificar | Adicionar `coupon_id` em `TENANT_WRITABLE_FIELDS` |
| `lib/checkout.ts` | Modificar | Aceitar `coupon` opcional; criar plano MP descontado on-the-fly |
| `app/api/cupons/validate/route.ts` | Criar | `GET ?code=&plan=` — validação pública com preview de desconto |
| `app/api/superadmin/cupons/route.ts` | Criar | `GET` lista + `POST` cria cupom |
| `app/superadmin/(panel)/cupons/page.tsx` | Criar | Lista de cupons no painel superadmin |
| `app/superadmin/(panel)/cupons/novo/page.tsx` | Criar | Formulário de criação de cupom |
| `components/marketing/SignupForm.tsx` | Modificar | Campo de cupom + validação on-blur + preview de desconto |
| `app/(public)/assinar/page.tsx` | Modificar | Passar `couponCode` para `SignupForm` |
| `app/api/assinar/route.ts` | Modificar | Validar cupom, passar para checkout, salvar `coupon_id` no tenant |
| `tests/lib/checkout.test.ts` | Modificar | Testes do checkout com cupom |
| `tests/lib/db/coupons.test.ts` | Criar | Testes das funções de DB |

---

## Task 1: Schema + Migration

**Files:**
- Modify: `lib/schema.ts`
- Create: `drizzle/0013_coupons.sql`

- [ ] **Step 1: Adicionar tabela `coupons` e coluna `tenants.coupon_id` em `lib/schema.ts`**

Adicionar logo após a definição de `partners` (antes de `demand_events`), aproveitando que `users` e `partners` já estão definidos acima:

```ts
// Em lib/schema.ts — adicionar após o bloco de `partners`:

export const coupons = sqliteTable("coupons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  description: text("description"),
  /** 'percentage' | 'fixed' | 'free_month' */
  discount_type: text("discount_type").notNull(),
  /** Null para free_month. Percentual inteiro (ex: 10) ou centavos (ex: 5000 = R$50). */
  discount_value: integer("discount_value"),
  max_uses: integer("max_uses").notNull().default(1),
  used_count: integer("used_count").notNull().default(0),
  expires_at: text("expires_at"),
  created_by: integer("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  partner_id: integer("partner_id").references(() => partners.id, { onDelete: "set null" }),
  created_at: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
```

Na tabela `tenants`, adicionar antes do campo `created_at`:
```ts
  coupon_id: integer("coupon_id").references(() => coupons.id, { onDelete: "set null" }),
```

No final do arquivo, adicionar os tipos exportados:
```ts
export type CouponRow = typeof coupons.$inferSelect;
export type NewCoupon = typeof coupons.$inferInsert;
```

- [ ] **Step 2: Criar migration `drizzle/0013_coupons.sql`**

```sql
CREATE TABLE `coupons` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `code` text NOT NULL,
  `description` text,
  `discount_type` text NOT NULL,
  `discount_value` integer,
  `max_uses` integer NOT NULL DEFAULT 1,
  `used_count` integer NOT NULL DEFAULT 0,
  `expires_at` text,
  `created_by` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `partner_id` integer REFERENCES `partners`(`id`) ON DELETE SET NULL,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX `coupons_code_unique` ON `coupons` (`code`);

ALTER TABLE `tenants` ADD `coupon_id` integer REFERENCES `coupons`(`id`) ON DELETE SET NULL;
```

- [ ] **Step 3: Build para verificar tipos**

```bash
cd /Users/ulpio/Projects/fast-sites/pedro-ivo-veiculos
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros relacionados a `coupons` ou `coupon_id`.

- [ ] **Step 4: Commit**

```bash
git add lib/schema.ts drizzle/0013_coupons.sql
git commit -m "feat(schema): add coupons table and tenants.coupon_id FK"
```

---

## Task 2: `lib/db/coupons.ts` + exportar do index

**Files:**
- Create: `lib/db/coupons.ts`
- Modify: `lib/db/index.ts`
- Modify: `lib/db/tenants.ts`
- Create: `tests/lib/db/coupons.test.ts`

- [ ] **Step 1: Criar `lib/db/coupons.ts`**

```ts
import { desc, eq, sql } from "drizzle-orm";
import { coupons } from "@/lib/schema";
import type { CouponRow, NewCoupon } from "@/lib/schema";
import { db } from "./client";

export async function listCoupons(): Promise<CouponRow[]> {
  return db.select().from(coupons).orderBy(desc(coupons.created_at));
}

export async function getCouponByCodeRaw(code: string): Promise<CouponRow | null> {
  const [row] = await db
    .select()
    .from(coupons)
    .where(eq(coupons.code, code.toUpperCase()))
    .limit(1);
  return row ?? null;
}

/**
 * Cupom **utilizável** num cadastro: precisa ter usos restantes e não estar expirado.
 */
export async function getCouponByCode(code: string): Promise<CouponRow | null> {
  const coupon = await getCouponByCodeRaw(code);
  if (!coupon) return null;
  if (coupon.used_count >= coupon.max_uses) return null;
  if (coupon.expires_at && coupon.expires_at < new Date().toISOString().slice(0, 10)) {
    return null;
  }
  return coupon;
}

export async function createCoupon(input: NewCoupon): Promise<CouponRow> {
  const [row] = await db
    .insert(coupons)
    .values({ ...input, code: input.code.toUpperCase() })
    .returning();
  return row;
}

export async function incrementCouponUse(id: number): Promise<void> {
  await db
    .update(coupons)
    .set({ used_count: sql`${coupons.used_count} + 1` })
    .where(eq(coupons.id, id));
}
```

- [ ] **Step 2: Adicionar export em `lib/db/index.ts`**

Adicionar no final do arquivo:
```ts
export * from "./coupons";
```

- [ ] **Step 3: Adicionar `coupon_id` em `TENANT_WRITABLE_FIELDS` em `lib/db/tenants.ts`**

Localizar `TENANT_WRITABLE_FIELDS` (linha ~40) e adicionar `"coupon_id"` na lista:
```ts
const TENANT_WRITABLE_FIELDS = [
  // ... campos existentes ...
  "referred_by",
  "coupon_id",   // ← adicionar aqui
] as const;
```

- [ ] **Step 4: Escrever o teste**

Criar `tests/lib/db/coupons.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: mockSelect }), orderBy: mockSelect }) }),
    insert: () => ({ values: () => ({ returning: mockInsert }) }),
    update: () => ({ set: () => ({ where: mockUpdate }) }),
  },
}));

vi.mock("@/lib/schema", () => ({
  coupons: { code: "code", used_count: "used_count", id: "id", created_at: "created_at" },
}));

describe("getCouponByCode", () => {
  beforeEach(() => vi.resetAllMocks());

  it("retorna null quando não encontra cupom", async () => {
    mockSelect.mockResolvedValue([]);
    const { getCouponByCode } = await import("@/lib/db/coupons");
    expect(await getCouponByCode("INVALIDO")).toBeNull();
  });

  it("retorna null quando cupom esgotado", async () => {
    mockSelect.mockResolvedValue([{
      code: "PROMO10",
      used_count: 1,
      max_uses: 1,
      expires_at: null,
    }]);
    const { getCouponByCode } = await import("@/lib/db/coupons");
    expect(await getCouponByCode("PROMO10")).toBeNull();
  });

  it("retorna cupom válido quando tem usos disponíveis", async () => {
    const coupon = { code: "PROMO10", used_count: 0, max_uses: 5, expires_at: null };
    mockSelect.mockResolvedValue([coupon]);
    const { getCouponByCode } = await import("@/lib/db/coupons");
    expect(await getCouponByCode("PROMO10")).toEqual(coupon);
  });

  it("retorna null quando cupom expirado", async () => {
    mockSelect.mockResolvedValue([{
      code: "OLD",
      used_count: 0,
      max_uses: 10,
      expires_at: "2020-01-01",
    }]);
    const { getCouponByCode } = await import("@/lib/db/coupons");
    expect(await getCouponByCode("OLD")).toBeNull();
  });
});
```

- [ ] **Step 5: Rodar os testes**

```bash
npx vitest run tests/lib/db/coupons.test.ts 2>&1
```

Esperado: todos passando.

- [ ] **Step 6: Commit**

```bash
git add lib/db/coupons.ts lib/db/index.ts lib/db/tenants.ts tests/lib/db/coupons.test.ts
git commit -m "feat(db): add coupons module with getCouponByCode and CRUD"
```

---

## Task 3: `lib/checkout.ts` — suporte a cupom + plano MP on-the-fly

**Files:**
- Modify: `lib/checkout.ts`
- Modify: `tests/lib/checkout.test.ts`

- [ ] **Step 1: Substituir o conteúdo de `lib/checkout.ts`**

```ts
import MercadoPagoConfig, { PreApproval, PreApprovalPlan } from "mercadopago";
import type { Plan } from "@/lib/plans";
import type { CouponRow, PartnerRow, TenantRow } from "@/lib/schema";

function getMpClient() {
  return new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! });
}

function centavosToReais(centavos: number): number {
  return Math.round(centavos) / 100;
}

async function createDiscountedMpPlan(plan: Plan, coupon: CouponRow): Promise<string> {
  const baseBRL = centavosToReais(plan.priceMonthly);

  let amount: number;
  let reason: string;

  if (coupon.discount_type === "percentage") {
    amount = Math.round(plan.priceMonthly * (1 - (coupon.discount_value ?? 0) / 100)) / 100;
    reason = `AutoStand ${plan.name} — ${coupon.discount_value}% de desconto`;
  } else if (coupon.discount_type === "fixed") {
    amount = Math.max(0.01, centavosToReais(plan.priceMonthly - (coupon.discount_value ?? 0)));
    reason = `AutoStand ${plan.name} — desconto especial`;
  } else {
    // free_month — preço base + trial de 1 mês
    amount = baseBRL;
    reason = `AutoStand ${plan.name} — 1º mês grátis`;
  }

  const body: Record<string, unknown> = {
    reason,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: amount,
      currency_id: "BRL",
      ...(coupon.discount_type === "free_month"
        ? { free_trial: { frequency: 1, frequency_type: "months" } }
        : {}),
    },
    back_url: `https://${process.env.PLATFORM_DOMAIN ?? "autostand.com.br"}/admin/assinatura`,
  };

  const preApprovalPlan = new PreApprovalPlan(getMpClient());
  const newPlan = await preApprovalPlan.create({ body: body as Parameters<typeof preApprovalPlan.create>[0]["body"] });
  return newPlan.id!;
}

/**
 * Builds the MP plan checkout URL.
 * If a coupon is provided, creates a discounted plan on-the-fly via PreApprovalPlan API.
 */
export async function createCheckoutSession(
  tenant: TenantRow,
  plan: Plan,
  _partner: PartnerRow | null,
  coupon?: CouponRow | null,
): Promise<string | null> {
  const mpPlanId = coupon
    ? await createDiscountedMpPlan(plan, coupon)
    : plan.mpPlanId;

  if (!mpPlanId) return null;

  const params = new URLSearchParams({
    preapproval_plan_id: mpPlanId,
    external_reference: String(tenant.id),
  });

  return `https://www.mercadopago.com.br/subscriptions/checkout?${params.toString()}`;
}

export async function cancelMpSubscription(subscriptionId: string): Promise<void> {
  const preApproval = new PreApproval(getMpClient());
  await preApproval.update({ id: subscriptionId, body: { status: "cancelled" } });
}
```

- [ ] **Step 2: Adicionar testes de checkout com cupom em `tests/lib/checkout.test.ts`**

Adicionar os seguintes casos de teste ao bloco `describe("createCheckoutSession")` existente:

```ts
  it("cria plano MP on-the-fly e retorna URL quando há cupom percentage", async () => {
    const mockPlanCreate = vi.fn().mockResolvedValue({ id: "plan_discounted_123" });
    vi.doMock("mercadopago", () => {
      const MercadoPagoConfig = vi.fn();
      function PreApproval() { return { create: mockCreate, update: vi.fn() }; }
      function PreApprovalPlan() { return { create: mockPlanCreate }; }
      return { default: MercadoPagoConfig, MercadoPagoConfig, PreApproval, PreApprovalPlan };
    });
    const { createCheckoutSession } = await import("@/lib/checkout");
    const coupon = {
      id: 1, code: "PROMO10", discount_type: "percentage",
      discount_value: 10, max_uses: 1, used_count: 0,
      expires_at: null, created_by: 1, partner_id: null, description: null, created_at: "",
    } as any;
    const result = await createCheckoutSession(
      { id: "tenant_1", slug: "autoprime" } as any,
      { slug: "basico", name: "Básico", priceMonthly: 16990, mpPlanId: "plan_basico_id" } as any,
      null,
      coupon,
    );
    expect(mockPlanCreate).toHaveBeenCalledOnce();
    expect(result).toContain("plan_discounted_123");
  });

  it("retorna null quando sem mpPlanId e sem cupom", async () => {
    const { createCheckoutSession } = await import("@/lib/checkout");
    const result = await createCheckoutSession(
      { id: "tenant_1", slug: "autoprime" } as any,
      { slug: "basico", name: "Básico", mpPlanId: undefined } as any,
      null,
    );
    expect(result).toBeNull();
  });
```

- [ ] **Step 3: Rodar os testes**

```bash
npx vitest run tests/lib/checkout.test.ts 2>&1
```

Esperado: todos passando.

- [ ] **Step 4: Commit**

```bash
git add lib/checkout.ts tests/lib/checkout.test.ts
git commit -m "feat(checkout): support discounted MP plan creation on-the-fly for coupons"
```

---

## Task 4: `GET /api/cupons/validate` — endpoint público de validação

**Files:**
- Create: `app/api/cupons/validate/route.ts`

- [ ] **Step 1: Criar `app/api/cupons/validate/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getCouponByCode } from "@/lib/db";
import { getPlan, isPlanSlug } from "@/lib/plans";

function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") ?? "").trim();
  const planSlug = searchParams.get("plan") ?? "";

  if (!code) {
    return NextResponse.json({ valid: false, error: "Informe o código do cupom." });
  }
  if (!isPlanSlug(planSlug)) {
    return NextResponse.json({ valid: false, error: "Plano inválido." });
  }

  const coupon = await getCouponByCode(code);
  if (!coupon) {
    return NextResponse.json({ valid: false, error: "Cupom inválido ou expirado." });
  }

  const plan = getPlan(planSlug);
  let discountedCents: number;
  let preview: string;

  if (coupon.discount_type === "percentage") {
    discountedCents = Math.round(plan.priceMonthly * (1 - (coupon.discount_value ?? 0) / 100));
    preview = `${coupon.discount_value}% de desconto — ${formatBRL(discountedCents)}/mês`;
  } else if (coupon.discount_type === "fixed") {
    discountedCents = Math.max(0, plan.priceMonthly - (coupon.discount_value ?? 0));
    preview = `${formatBRL(coupon.discount_value ?? 0)} de desconto — ${formatBRL(discountedCents)}/mês`;
  } else {
    discountedCents = plan.priceMonthly;
    preview = "Primeiro mês grátis!";
  }

  return NextResponse.json({
    valid: true,
    preview,
    discountedCents,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      description: coupon.description,
    },
  });
}
```

- [ ] **Step 2: Build para verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros no arquivo novo.

- [ ] **Step 3: Commit**

```bash
git add app/api/cupons/validate/route.ts
git commit -m "feat(api): add public GET /api/cupons/validate endpoint"
```

---

## Task 5: `GET+POST /api/superadmin/cupons`

**Files:**
- Create: `app/api/superadmin/cupons/route.ts`

O superadmin autentica-se via `withSuperAdmin` (ver `lib/api.ts`). Para o `created_by`, o wrapper expõe a sessão — verificar como `withSuperAdmin` passa o userId. Se não passar, usar um valor fixo de superadmin via `getUserByEmail("super@plataforma.com")` ou ler da sessão.

- [ ] **Step 1: Verificar como obter o userId na rota protegida**

```bash
grep -n "withSuperAdmin\|session\|userId" /Users/ulpio/Projects/fast-sites/pedro-ivo-veiculos/lib/api.ts | head -20
```

Se o wrapper passa o userId na request, usar diretamente. Se não, usar a sessão de NextAuth:

```bash
grep -n "auth\|getServerSession" /Users/ulpio/Projects/fast-sites/pedro-ivo-veiculos/app/api/superadmin/parceiros/route.ts
```

- [ ] **Step 2: Criar `app/api/superadmin/cupons/route.ts`**

Modelo baseado em `app/api/superadmin/parceiros/route.ts`. O `created_by` requer o ID do usuário superadmin logado — ler da sessão NextAuth (`auth()`) ou da DB pelo email fixo. Adaptar conforme o que o Step 1 revelar.

Estrutura base:

```ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ApiError, withSuperAdmin } from "@/lib/api";
import { createCoupon, getCouponByCodeRaw, getUserByEmail, listCoupons } from "@/lib/db";

export const GET = withSuperAdmin(async () => {
  return NextResponse.json(await listCoupons());
});

export const POST = withSuperAdmin(async (req) => {
  const body = await req.json();
  const session = await auth();

  const code = String(body.code ?? "").trim().toUpperCase();
  const description = String(body.description ?? "").trim() || null;
  const discount_type = ["percentage", "fixed", "free_month"].includes(body.discount_type)
    ? (body.discount_type as "percentage" | "fixed" | "free_month")
    : null;
  const discount_value =
    body.discount_type !== "free_month"
      ? Math.max(0, Math.round(Number(body.discount_value) || 0))
      : null;
  const max_uses = Math.max(1, Math.round(Number(body.max_uses) || 1));
  const expires_at =
    typeof body.expires_at === "string" && body.expires_at.trim()
      ? body.expires_at.trim()
      : null;
  const partner_id =
    body.partner_id != null && body.partner_id !== ""
      ? Math.round(Number(body.partner_id))
      : null;

  if (code.length < 3) throw new ApiError("O código precisa de ao menos 3 caracteres.", 400);
  if (!discount_type) throw new ApiError("Tipo de desconto inválido.", 400);
  if (discount_type === "percentage" && (discount_value ?? 0) > 100) {
    throw new ApiError("Percentual não pode passar de 100.", 400);
  }
  if (await getCouponByCodeRaw(code)) {
    throw new ApiError("Já existe um cupom com este código.", 400);
  }

  // Obter o ID do superadmin logado
  const superAdmin = await getUserByEmail(session?.user?.email ?? "");
  if (!superAdmin) throw new ApiError("Usuário não encontrado.", 401);

  const coupon = await createCoupon({
    code,
    description,
    discount_type,
    discount_value,
    max_uses,
    expires_at,
    partner_id,
    created_by: superAdmin.id,
  });

  return NextResponse.json(coupon, { status: 201 });
});
```

> **Nota:** Se `auth()` não estiver disponível no contexto `withSuperAdmin`, verificar se o wrapper já autentica e passa o userId, ou usar `getServerSession` do NextAuth.

- [ ] **Step 3: Verificar que `getUserByEmail` está exportado de `lib/db`**

```bash
grep "getUserByEmail" /Users/ulpio/Projects/fast-sites/pedro-ivo-veiculos/lib/db/users.ts
```

Se não existir, adicionar em `lib/db/users.ts`:
```ts
export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row ?? null;
}
```

E verificar se já está exportado; já é usado em `app/api/assinar/route.ts`, então deve existir.

- [ ] **Step 4: Build**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add app/api/superadmin/cupons/route.ts
git commit -m "feat(api): add superadmin cupons GET/POST endpoints"
```

---

## Task 6: UI Superadmin — lista + formulário de cupons

**Files:**
- Create: `app/superadmin/(panel)/cupons/page.tsx`
- Create: `app/superadmin/(panel)/cupons/novo/page.tsx`

Seguir exatamente o padrão de `app/superadmin/(panel)/parceiros/page.tsx` e `parceiros/novo/page.tsx`.

- [ ] **Step 1: Criar página de lista `app/superadmin/(panel)/cupons/page.tsx`**

```tsx
import Link from "next/link";
import { Plus, Tag } from "lucide-react";
import { listCoupons } from "@/lib/db";

export const dynamic = "force-dynamic";

function formatDesconto(type: string, value: number | null): string {
  if (type === "free_month") return "1º mês grátis";
  if (type === "fixed") {
    return ((value ?? 0) / 100).toLocaleString("pt-BR", {
      style: "currency", currency: "BRL", maximumFractionDigits: 0,
    }) + " off";
  }
  return `${value ?? 0}% off`;
}

export default async function CuponsPage() {
  const cupons = await listCoupons();

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Cupons</h1>
          <p className="text-sm text-n600 mt-1">{cupons.length} cadastrados</p>
        </div>
        <Link
          href="/superadmin/cupons/novo"
          className="inline-flex items-center gap-2 bg-signal text-ink text-sm font-medium px-4 py-2 rounded-lg hover:bg-signal-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo cupom
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-n200/70 overflow-hidden">
        <table className="min-w-full divide-y divide-n100 text-sm">
          <thead>
            <tr className="bg-n50">
              {["Código", "Desconto", "Usos", "Validade", ""].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-n600 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-n100">
            {cupons.map((c) => (
              <tr key={c.id} className="hover:bg-n50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-signal" />
                    <span className="font-mono font-semibold text-ink">{c.code}</span>
                  </div>
                  {c.description && (
                    <p className="text-xs text-n400 mt-0.5">{c.description}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-n600 whitespace-nowrap">
                  {formatDesconto(c.discount_type, c.discount_value)}
                </td>
                <td className="px-4 py-3 text-n600 whitespace-nowrap">
                  {c.used_count}
                  <span className="text-n400"> / {c.max_uses}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-n600">
                  {c.expires_at ?? <span className="text-n400">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      c.used_count < c.max_uses
                        ? "bg-success/12 text-ink ring-1 ring-success/30"
                        : "bg-n100 text-n600 ring-1 ring-n200"
                    }`}
                  >
                    {c.used_count < c.max_uses ? "Disponível" : "Esgotado"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {cupons.length === 0 && (
          <div className="py-16 text-center text-n400">
            <p className="font-medium">Nenhum cupom cadastrado</p>
            <Link
              href="/superadmin/cupons/novo"
              className="mt-3 inline-block text-sm text-signal hover:text-signal-dark"
            >
              Criar o primeiro →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Criar formulário `app/superadmin/(panel)/cupons/novo/page.tsx`**

Seguir o padrão do formulário de parceiros, usando `fetch("POST", "/api/superadmin/cupons")` e `router.push("/superadmin/cupons")` no sucesso:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "w-full rounded-lg border border-n200 bg-white px-3 py-2 text-sm text-ink placeholder-n400 outline-none focus:border-signal focus:ring-2 focus:ring-signal/30";
const labelClass = "block text-sm font-medium text-ink";

export default function NovoCupomPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed" | "free_month">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/superadmin/cupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code.toUpperCase(),
        description: description || null,
        discount_type: discountType,
        discount_value: discountType !== "free_month" ? Number(discountValue) : null,
        max_uses: Number(maxUses),
        expires_at: expiresAt || null,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erro ao criar cupom.");
      setSubmitting(false);
      return;
    }
    router.push("/superadmin/cupons");
  }

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold text-ink mb-8">Novo cupom</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="code" className={labelClass}>Código do cupom</label>
          <input
            id="code"
            className={`mt-1 font-mono uppercase ${inputClass}`}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
            placeholder="PROMO10"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className={labelClass}>Descrição (opcional)</label>
          <input
            id="description"
            className={`mt-1 ${inputClass}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Campanha de junho"
          />
        </div>

        <div>
          <label className={labelClass}>Tipo de desconto</label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {([
              ["percentage", "% desconto"],
              ["fixed", "R$ desconto"],
              ["free_month", "1º mês grátis"],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setDiscountType(val)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  discountType === val
                    ? "border-signal bg-signal/10 text-ink"
                    : "border-n200 text-n600 hover:border-n400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {discountType !== "free_month" && (
          <div>
            <label htmlFor="discount_value" className={labelClass}>
              {discountType === "percentage" ? "Percentual de desconto (%)" : "Valor de desconto (R$)"}
            </label>
            <input
              id="discount_value"
              type="number"
              className={`mt-1 ${inputClass}`}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === "percentage" ? "10" : "50"}
              min="0"
              max={discountType === "percentage" ? "100" : undefined}
              required
            />
            {discountType === "percentage" && (
              <p className="mt-1 text-xs text-n400">0–100%</p>
            )}
            {discountType === "fixed" && (
              <p className="mt-1 text-xs text-n400">
                Valor em reais (ex: 50 = R$ 50,00 de desconto recorrente)
              </p>
            )}
          </div>
        )}

        <div>
          <label htmlFor="max_uses" className={labelClass}>Número máximo de usos</label>
          <input
            id="max_uses"
            type="number"
            className={`mt-1 ${inputClass}`}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            min="1"
            required
          />
        </div>

        <div>
          <label htmlFor="expires_at" className={labelClass}>Validade (opcional)</label>
          <input
            id="expires_at"
            type="date"
            className={`mt-1 ${inputClass}`}
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-lg bg-signal px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-signal-dark disabled:opacity-60"
          >
            {submitting ? "Criando…" : "Criar cupom"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2.5 rounded-lg border border-n200 text-sm font-medium text-n700 hover:bg-n50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Verificar que o link "Cupons" existe na nav do superadmin**

```bash
grep -rn "parceiros\|Parceiros" /Users/ulpio/Projects/fast-sites/pedro-ivo-veiculos/app/superadmin --include="*.tsx" -l
```

Abrir o arquivo de layout/nav e adicionar link para `/superadmin/cupons` seguindo o mesmo padrão do link de Parceiros.

- [ ] **Step 4: Build**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add app/superadmin/\(panel\)/cupons/ app/api/superadmin/cupons/
git commit -m "feat(ui): add superadmin cupons list and create pages"
```

---

## Task 7: `SignupForm` — campo de cupom + preview

**Files:**
- Modify: `components/marketing/SignupForm.tsx`
- Modify: `app/(public)/assinar/page.tsx`

- [ ] **Step 1: Adicionar estado e lógica de cupom em `SignupForm`**

Adicionar após os estados existentes (`captchaToken`, etc.):

```ts
const [couponCode, setCouponCode] = useState("");
const [couponState, setCouponState] = useState<
  | { status: "idle" }
  | { status: "validating" }
  | { status: "valid"; preview: string }
  | { status: "invalid"; error: string }
>({ status: "idle" });
```

Adicionar a função de validação:

```ts
async function validateCoupon(code: string) {
  if (!code.trim()) {
    setCouponState({ status: "idle" });
    return;
  }
  setCouponState({ status: "validating" });
  try {
    const res = await fetch(
      `/api/cupons/validate?code=${encodeURIComponent(code)}&plan=${plan}`,
    );
    const data = await res.json();
    if (data.valid) {
      setCouponState({ status: "valid", preview: data.preview });
    } else {
      setCouponState({ status: "invalid", error: data.error ?? "Cupom inválido." });
    }
  } catch {
    setCouponState({ status: "invalid", error: "Erro ao validar cupom." });
  }
}
```

Quando o plano muda, revalidar o cupom se já houver código preenchido:

```ts
// Adicionar no handler do onChange de plan:
setPlan(s);
if (couponCode) validateCoupon(couponCode); // revalida com novo plano
```

No `handleSubmit`, passar o `coupon_code` no body:

```ts
body: JSON.stringify({
  // ... campos existentes ...
  coupon_code: couponCode.trim().toUpperCase() || null,
}),
```

- [ ] **Step 2: Adicionar o campo de cupom no JSX**

Adicionar entre o bloco de senha e o Turnstile/captcha:

```tsx
{/* Cupom (opcional) */}
<div>
  <label htmlFor="coupon_code" className={labelClass}>
    Código de cupom <span className="text-n400 font-normal">(opcional)</span>
  </label>
  <input
    id="coupon_code"
    className={`mt-1 font-mono uppercase ${inputClass} ${
      couponState.status === "valid" ? "border-success focus:border-success focus:ring-success/30" :
      couponState.status === "invalid" ? "border-danger focus:border-danger focus:ring-danger/30" : ""
    }`}
    value={couponCode}
    onChange={(e) => {
      const val = e.target.value.toUpperCase().replace(/\s/g, "");
      setCouponCode(val);
      if (!val) setCouponState({ status: "idle" });
    }}
    onBlur={() => validateCoupon(couponCode)}
    placeholder="PROMO10"
    autoComplete="off"
  />
  {couponState.status === "validating" && (
    <p className="mt-1 text-body-s text-n400">Validando…</p>
  )}
  {couponState.status === "valid" && (
    <p className="mt-1 text-body-s text-success">✓ {couponState.preview}</p>
  )}
  {couponState.status === "invalid" && (
    <p className="mt-1 text-body-s text-danger">{couponState.error}</p>
  )}
</div>
```

- [ ] **Step 3: Verificar que `text-success` e `border-success` existem no Tailwind config**

```bash
grep -n "success" /Users/ulpio/Projects/fast-sites/pedro-ivo-veiculos/tailwind.config.ts | head -10
```

Se não existirem, usar `text-green-600` e `border-green-500` no lugar.

- [ ] **Step 4: Build**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add components/marketing/SignupForm.tsx app/\(public\)/assinar/page.tsx
git commit -m "feat(ui): add coupon code field with on-blur validation and discount preview to SignupForm"
```

---

## Task 8: `POST /api/assinar` — integrar cupom no fluxo de cadastro

**Files:**
- Modify: `app/api/assinar/route.ts`

- [ ] **Step 1: Adicionar leitura e validação do cupom em `POST /api/assinar`**

Após as validações existentes (slug, email, senha), adicionar:

```ts
const couponCodeRaw = String(body.coupon_code ?? "").trim().toUpperCase();
const coupon = couponCodeRaw ? await getCouponByCode(couponCodeRaw) : null;

// Se um código foi fornecido mas não é válido, falhar cedo.
if (couponCodeRaw && !coupon) {
  return bad("Cupom inválido ou expirado.");
}
```

Atualizar os imports para incluir `getCouponByCode` e `incrementCouponUse`:

```ts
import {
  createTenant,
  createUser,
  getCouponByCode,
  getPartnerByCode,
  getTenantBySlug,
  getUserByEmail,
  incrementCouponUse,
  incrementPartnerSignup,
} from "@/lib/db";
```

Atualizar `createTenant` para incluir `coupon_id`:

```ts
const tenant = await createTenant({
  slug,
  name: dealershipName,
  plan,
  status: "suspended",
  subscription_status: "incomplete",
  referred_by: partner?.id ?? null,
  coupon_id: coupon?.id ?? null,   // ← adicionar
});
```

Atualizar `createCheckoutSession` para passar o cupom:

```ts
const checkoutUrl = await createCheckoutSession(tenant, getPlan(plan), partner, coupon);
```

Após `incrementPartnerSignup`, adicionar:

```ts
if (coupon) await incrementCouponUse(coupon.id);
```

- [ ] **Step 2: Rodar todos os testes**

```bash
npx vitest run 2>&1 | tail -20
```

Esperado: todos os 28+ testes passando.

- [ ] **Step 3: Build completo**

```bash
npx next build 2>&1 | tail -20
```

Esperado: sem erros.

- [ ] **Step 4: Commit final**

```bash
git add app/api/assinar/route.ts
git commit -m "feat(api): integrate coupon validation and MP discounted plan creation into /api/assinar"
```

---

## Self-Review

### Spec coverage

| Requisito (HANDOFF.md) | Task |
|---|---|
| Migration 0013 — tabela `coupons` + `tenants.coupon_id` | Task 1 |
| `lib/db/coupons.ts` — CRUD | Task 2 |
| `lib/checkout.ts` — cupom → plano MP descontado on-the-fly | Task 3 |
| `GET /api/cupons/validate` — validação pública | Task 4 |
| `POST /api/superadmin/cupons` — criação | Task 5 |
| `GET /api/superadmin/cupons` — listagem | Task 5 |
| `/superadmin/cupons` — página lista + criação | Task 6 |
| `/assinar` — campo cupom + preview | Task 7 |
| `POST /api/assinar` — integrar cupom | Task 8 |
| `incrementCouponUse` no submit (não no webhook) | Task 8 |
| `coupon_id` salvo no tenant | Task 8 |
| `back_url` do plano descontado = `autostand.com.br/admin/assinatura` | Task 3 |

### Type consistency check

- `CouponRow` definido em Task 1 (schema), usado em Tasks 2, 3, 4, 5, 8 ✅
- `NewCoupon` definido em Task 1, usado em `createCoupon` (Task 2) ✅
- `createCheckoutSession(tenant, plan, partner, coupon?)` — assinatura nova em Task 3, usada em Task 8 ✅
- `getCouponByCode` retorna `CouponRow | null` — consistente em Tasks 2, 4, 8 ✅
- `coupon_id` em `TENANT_WRITABLE_FIELDS` (Task 2) para fluir no `createTenant` (Task 8) ✅

### Placeholder scan

Sem placeholders encontrados — todo código está concreto.

### Nota sobre Task 5 (`created_by`)

A Task 5 instrui a verificar como `withSuperAdmin` expõe a sessão antes de escrever o código final. Se `auth()` não estiver disponível ali, a alternativa é ler o ID do superadmin a partir do email da sessão NextAuth — que é o padrão já usado em outras rotas do projeto. O passo está explicitado na task.
