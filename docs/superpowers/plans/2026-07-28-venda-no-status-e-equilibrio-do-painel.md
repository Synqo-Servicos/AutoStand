# Venda a partir do status, preço da assinatura e equilíbrio do painel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o lojista registrar a venda no momento em que marca o veículo como vendido (com fila de pendências como rede de segurança), esconder o preço do plano no painel e equilibrar o layout do admin em monitores grandes.

**Architecture:** Três frentes independentes sobre o painel `/admin` do Next.js App Router. A venda reaproveita a API de transações existente (`POST /api/transactions` com `type: "saida"`), que já cria a comissão do vendedor e sincroniza o status do veículo — nada de schema novo. A fila de "vendas a registrar" é uma **consulta derivada** (veículo `vendido` sem transação `saida`), então não existe estado de pendência para divergir. O layout ganha um canvas centralizado no layout do admin em vez de tetos soltos por página.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, TypeScript, Tailwind v4 com tokens próprios, Drizzle ORM + Postgres (Neon), Radix UI via `components/ui`, vitest.

**Spec:** `docs/superpowers/specs/2026-07-28-venda-no-status-e-equilibrio-do-painel-design.md`

## Global Constraints

- **Sem migration.** Nenhuma frente altera o schema. Se você achar que precisa de coluna nova, parou — reveja o spec.
- **Copy em pt-BR**, sempre. Inclusive mensagens de erro e toasts.
- **Dinheiro em centavos** (`integer`) no banco e na API. Conversão só na borda da UI, via `centsToDisplay` / `displayToCents` / `formatBRL` de `lib/money.ts`.
- **Só tokens de cor** do design system: `n50`–`n800`, `ink`, `signal`, `success`, `warning`, `danger`. Nunca `slate-*`, `gray-*` ou hex hardcoded.
- **Toda função de dados é tenant-scoped:** primeiro argumento `tenantId: number`, e *todas* as queries filtram por ele.
- **Rotas do painel usam `withTenant`** de `lib/api.ts`.
- **Client component nunca importa valor de `@/lib/db`** (arrasta Drizzle pro bundle). Tipos compartilhados moram em `types/*.ts`.
- **Testes:** vitest com `environment: "node"` e `include: ["tests/**/*.test.ts"]`. Não existe teste de componente neste repo — UI se verifica manualmente, e o plano diz exatamente como.
- **Commits:** conventional commits em pt-BR (`feat(admin): ...`, `refactor: ...`). **Nunca** adicionar linha `Co-Authored-By`.
- Branch de trabalho: `feat/venda-no-status-e-layout` (já existe, com o spec commitado).

---

## File Structure

**Criados:**

| Arquivo | Responsabilidade |
|---|---|
| `lib/commission.ts` | Regra de comissão, pura e importável pelo cliente. |
| `app/api/transactions/pendentes/route.ts` | `GET` das vendas marcadas mas não lançadas. |
| `components/admin/RegistrarVendaModal.tsx` | O pop-up de venda, usado nos dois pontos de entrada. |
| `tests/lib/commission.test.ts` | Cobre o novo módulo puro. |
| `tests/api/transactions-pendentes.test.ts` | Cobre a rota nova. |

**Modificados:**

| Arquivo | Mudança |
|---|---|
| `app/admin/(protected)/layout.tsx` | Canvas centralizado. |
| `components/admin/AdminSidebar.tsx` | Sidebar mais larga em telas grandes. |
| 8 páginas/loadings de tabela | `max-w-6xl` → `w-full`. |
| `app/admin/(protected)/assinatura/page.tsx` | Remove o preço. |
| `lib/db/sellers.ts` | Reexporta `computeCommission` do módulo novo. |
| `lib/db/transactions.ts` | Importa `computeCommission` do módulo novo; ganha `hasSaleTransaction`. |
| `lib/db/vehicles.ts` | Ganha `listPendingSales`. |
| `types/vehicle.ts` | Ganha o tipo `PendingSale`. |
| `components/admin/TransactionSlideOver.tsx` | Usa `computeCommission` em vez de recalcular inline. |
| `components/admin/VehicleForm.tsx` | Dispara o pop-up. |
| `app/admin/(protected)/veiculos/[id]/page.tsx` | Passa `hasSale`. |
| `app/admin/(protected)/transacoes/page.tsx` | Faixa "Vendas a registrar". |

---

### Task 1: Equilíbrio do painel no desktop

Frente 3 do spec. Puramente visual: nenhuma lógica muda, nenhum teste automatizado é possível (vitest aqui roda em Node e não renderiza componente). A verificação é `lint` + `tsc` + inspeção no navegador.

**Files:**
- Modify: `components/admin/AdminSidebar.tsx:106`
- Modify: `app/admin/(protected)/layout.tsx:37-46`
- Modify: `app/admin/(protected)/dashboard/page.tsx:26`, `app/admin/(protected)/dashboard/loading.tsx:5`
- Modify: `app/admin/(protected)/veiculos/page.tsx:16`, `app/admin/(protected)/veiculos/loading.tsx:5`
- Modify: `app/admin/(protected)/transacoes/page.tsx:52`, `app/admin/(protected)/transacoes/loading.tsx:5`
- Modify: `app/admin/(protected)/financeiro/page.tsx:34`, `app/admin/(protected)/financeiro/loading.tsx:5`

**Interfaces:**
- Consumes: nada.
- Produces: nada consumido por outras tasks. Tasks 6 e 7 editam `transacoes/page.tsx` depois — sem conflito lógico.

- [ ] **Step 1: Alargar a sidebar em telas grandes**

Em `components/admin/AdminSidebar.tsx`, no `className` do `<aside>` (linha 106), trocar `w-60` por `w-60 lg:w-64 xl:w-72`. O trecho fica:

```tsx
        className={`fixed lg:sticky inset-y-0 left-0 z-50 lg:z-auto top-0 lg:top-0 w-60 lg:w-64 xl:w-72 shrink-0 h-screen bg-white border-r border-n100 flex flex-col transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
```

O `w-60` continua valendo no mobile — é a largura do drawer, que não deve mudar.

- [ ] **Step 2: Centralizar o conteúdo num canvas**

Em `app/admin/(protected)/layout.tsx`, substituir o `return` (linhas 37-46) por:

```tsx
  return (
    <div className="min-h-screen bg-n50 lg:flex">
      <AdminSidebar tenantName={tenant.name} />
      <div className="flex-1 min-w-0 lg:overflow-auto">
        {tenant.status !== "active" && <SubscriptionBanner />}
        {/* Canvas centralizado: sem isto, cada página fica colada à esquerda e
            sobra meia tela em branco à direita em monitores de 1920px+. */}
        <div className="mx-auto w-full max-w-7xl">
          {children}
          <PlatformFooter />
        </div>
      </div>
    </div>
  );
```

O `SubscriptionBanner` fica **fora** do canvas de propósito: banner de alerta atravessa a largura toda.

- [ ] **Step 3: Soltar o teto das páginas de tabela**

As oito páginas de tabela devem ocupar o canvas inteiro. Rodar:

```bash
sed -i '' 's/max-w-6xl/w-full/' \
  "app/admin/(protected)/dashboard/page.tsx" \
  "app/admin/(protected)/dashboard/loading.tsx" \
  "app/admin/(protected)/veiculos/page.tsx" \
  "app/admin/(protected)/veiculos/loading.tsx" \
  "app/admin/(protected)/transacoes/page.tsx" \
  "app/admin/(protected)/transacoes/loading.tsx" \
  "app/admin/(protected)/financeiro/page.tsx" \
  "app/admin/(protected)/financeiro/loading.tsx"
```

Não mexer nas páginas de formulário/leitura (`assinatura`, `marketplace`, `analise`, `inteligencia`, `documentos`, `vendedores`, `veiculos/novo`, `veiculos/[id]`): a coluna estreita delas é largura de leitura, proposital.

- [ ] **Step 4: Conferir que só o esperado mudou**

Run: `grep -rn "max-w-6xl" "app/admin/(protected)"`
Expected: nenhuma saída.

Run: `git diff --stat`
Expected: exatamente 10 arquivos (sidebar + layout + 8 páginas), nenhuma linha fora de `className`.

- [ ] **Step 5: Lint e types**

Run: `npx tsc --noEmit`; depois `npm run lint 2>&1 | tail -3`
Expected: `tsc` sem nenhuma saída. O `npm run lint` **já falha na base deste repo** — 13 problemas (10 erros `react-hooks/set-state-in-effect` + 3 warnings), todos em arquivos pré-existentes. O gate do lint é *nenhum problema novo*: o total tem que continuar 13, e nenhum pode apontar para uma linha que você escreveu. Não conserte os erros pré-existentes — estão fora do escopo desta task.

- [ ] **Step 6: Verificar no navegador**

Run: `npm run dev` e abrir `/admin/veiculos` logado.

Conferir, redimensionando a janela:
- Em ~1920px de largura: a folga em branco fica **simétrica** dos dois lados, e a tabela de veículos está mais larga que antes.
- Em 1440px e 1280px: nada mudou visualmente (o `mx-auto` não tem efeito nessa faixa).
- Em mobile (<1024px): o header com o botão de menu e o drawer continuam idênticos.
- O rodapé "AutoStand · por Synqo" aparece no fim, com a borda superior acompanhando o canvas. O texto dele fica ~64px recuado em relação à tabela — isso é esperado e está registrado no spec.

- [ ] **Step 7: Commit**

```bash
git add "components/admin/AdminSidebar.tsx" "app/admin/(protected)"
git commit -m "feat(admin): centraliza o conteúdo do painel e alarga a sidebar em telas grandes"
```

---

### Task 2: Esconder o preço do plano na Assinatura

Frente 2 do spec.

**Files:**
- Modify: `app/admin/(protected)/assinatura/page.tsx:5,40`

**Interfaces:**
- Consumes: nada.
- Produces: nada.

- [ ] **Step 1: Remover a linha do preço**

Em `app/admin/(protected)/assinatura/page.tsx`, apagar a linha 40:

```tsx
            <p className="text-body-s text-n600">{formatBRL(plan.priceMonthly)}/mês</p>
```

O bloco fica:

```tsx
          <div>
            <p className="text-eyebrow font-semibold uppercase text-n600">Plano atual</p>
            <p className="mt-1 font-display text-h3 font-semibold text-ink">{plan.name}</p>
          </div>
```

- [ ] **Step 2: Remover o import órfão**

Apagar a linha 5, que fica sem uso:

```tsx
import { formatBRL } from "@/lib/money";
```

- [ ] **Step 3: Confirmar que nenhum outro ponto do painel mostra preço de plano**

Run: `grep -rn "priceMonthly" "app/admin" "components/admin"`
Expected: nenhuma saída. (Os usos restantes ficam em `components/marketing/*`, `lib/checkout.ts` e `lib/coupon-pricing.ts` — site público e checkout, que **não** mudam.)

- [ ] **Step 4: Lint e types**

Run: `npx tsc --noEmit`; depois `npm run lint 2>&1 | tail -3`
Expected: `tsc` sem nenhuma saída. O `npm run lint` **já falha na base deste repo** — 13 problemas (10 erros `react-hooks/set-state-in-effect` + 3 warnings), todos em arquivos pré-existentes. O gate do lint é *nenhum problema novo*: o total tem que continuar 13, e nenhum pode apontar para uma linha que você escreveu. Não conserte os erros pré-existentes — estão fora do escopo desta task. Se `tsc` reclamar de `formatBRL` não usado, o Step 2 não foi feito.

- [ ] **Step 5: Verificar no navegador**

Abrir `/admin/assinatura`: o card "Plano atual" mostra o nome do plano e o selo No ar/Pendente, sem valor nenhum. O botão "Gerenciar pagamento" continua onde estava.

- [ ] **Step 6: Commit**

```bash
git add "app/admin/(protected)/assinatura/page.tsx"
git commit -m "feat(admin): esconde o preço do plano na tela de assinatura"
```

---

### Task 3: Extrair a regra de comissão para um módulo puro

Frente 1 do spec, passo 1. Hoje a regra existe em duas cópias: `lib/db/sellers.ts:64` (servidor) e refeita à mão em `components/admin/TransactionSlideOver.tsx:45-51`, porque um client component não pode importar de `lib/db`. O pop-up novo precisa da mesma conta — extrair agora evita a terceira cópia.

**Files:**
- Create: `lib/commission.ts`
- Create: `tests/lib/commission.test.ts`
- Modify: `lib/db/sellers.ts:64-73`
- Modify: `lib/db/transactions.ts:6`
- Modify: `components/admin/TransactionSlideOver.tsx:45-51`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `computeCommission(saleAmountCents: number, seller: CommissionRule): number` em `@/lib/commission`
  - `interface CommissionRule { commission_pct: number | null; commission_fixed_cents: number | null }` em `@/lib/commission`
  - `computeCommission` continua exportado por `@/lib/db` e `@/lib/db/sellers` (reexport), sem quebrar caller nenhum.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/lib/commission.test.ts`. O comportamento já é coberto em profundidade por `tests/lib/db/sellers.test.ts` — este arquivo prova que o **módulo novo** existe e calcula igual; o antigo continua valendo como guarda do reexport.

```ts
import { describe, expect, it } from "vitest";
import { computeCommission } from "@/lib/commission";

// commission_pct é em centésimos de % (300 = 3%); valores em centavos.

describe("computeCommission (módulo puro, usado também no cliente)", () => {
  it("soma percentual e parcela fixa", () => {
    // 3% de R$ 50.000,00 = R$ 1.500,00, mais R$ 800,00 fixos
    expect(
      computeCommission(50_000_00, { commission_pct: 300, commission_fixed_cents: 800_00 }),
    ).toBe(2_300_00);
  });

  it("retorna 0 quando o vendedor não tem comissão configurada", () => {
    expect(
      computeCommission(50_000_00, { commission_pct: null, commission_fixed_cents: null }),
    ).toBe(0);
  });

  it("arredonda o percentual pro centavo mais próximo", () => {
    // 1,5% de R$ 3.333,33 = R$ 49,99995 → R$ 50,00
    expect(
      computeCommission(333_333, { commission_pct: 150, commission_fixed_cents: null }),
    ).toBe(50_00);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run tests/lib/commission.test.ts`
Expected: FAIL — não resolve `@/lib/commission` ("Failed to load url" / "Cannot find module").

- [ ] **Step 3: Criar o módulo**

Criar `lib/commission.ts`:

```ts
/**
 * Regra de comissão de venda — módulo puro, sem dependência de banco.
 *
 * Vive fora de `lib/db` porque os formulários de venda são client
 * components e não podem importar Drizzle. Antes disso, a conta existia
 * duplicada: uma vez no servidor e outra refeita à mão na UI.
 */

export interface CommissionRule {
  /** Percentual em centésimos de % — 350 = 3,5%. Null = sem percentual. */
  commission_pct: number | null;
  /** Parcela fixa, em centavos. Null = sem parcela fixa. */
  commission_fixed_cents: number | null;
}

export function computeCommission(
  saleAmountCents: number,
  seller: CommissionRule,
): number {
  const pctPart = seller.commission_pct
    ? Math.round((saleAmountCents * seller.commission_pct) / 10000)
    : 0;
  const fixedPart = seller.commission_fixed_cents ?? 0;
  return pctPart + fixedPart;
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run tests/lib/commission.test.ts`
Expected: PASS, 3 testes.

- [ ] **Step 5: Apontar o servidor para o módulo novo**

Em `lib/db/sellers.ts`, apagar a função `computeCommission` (linhas 64-73) e reexportar no lugar dela:

```ts
// A regra mora em lib/commission.ts (puro, importável pelo cliente).
// Reexportado aqui para não quebrar quem importa de @/lib/db.
export { computeCommission, type CommissionRule } from "@/lib/commission";
```

Em `lib/db/transactions.ts`, trocar a linha 6:

```ts
import { computeCommission } from "@/lib/commission";
```

- [ ] **Step 6: Rodar a suíte inteira**

Run: `npm test`
Expected: tudo verde — inclusive `tests/lib/db/sellers.test.ts`, que continua importando de `@/lib/db/sellers` e agora exercita o reexport.

- [ ] **Step 7: Eliminar a cópia da conta na UI**

Em `components/admin/TransactionSlideOver.tsx`, adicionar o import:

```tsx
import { computeCommission } from "@/lib/commission";
```

E substituir o bloco das linhas 45-51 por:

```tsx
  const previewCommission = (() => {
    if (type !== "saida" || !selectedSeller || !amountStr) return null;
    return computeCommission(displayToCents(amountStr), selectedSeller);
  })();
```

- [ ] **Step 8: Lint, types e suíte**

Run: `npx tsc --noEmit`; depois `npm run lint 2>&1 | tail -3`; depois `npm test`
Expected: `tsc` sem nenhuma saída. `npm test` todo verde. O `npm run lint` **já falha na base deste repo** — 13 problemas (10 erros `react-hooks/set-state-in-effect` + 3 warnings), todos em arquivos pré-existentes. O gate do lint é *nenhum problema novo*: o total tem que continuar 13, e nenhum pode apontar para uma linha que você escreveu. Não conserte os erros pré-existentes — estão fora do escopo desta task.

- [ ] **Step 9: Commit**

```bash
git add lib/commission.ts tests/lib/commission.test.ts lib/db/sellers.ts lib/db/transactions.ts components/admin/TransactionSlideOver.tsx
git commit -m "refactor: extrai a regra de comissão para lib/commission (fonte única)"
```

---

### Task 4: Consulta e rota das vendas pendentes

Frente 1 do spec, passo 2. A fila é derivada: veículo `vendido` **sem** transação `saida`.

Atenção honesta sobre teste: o repo não tem banco em teste (`tests/lib/db/*` cobre só helpers puros). O teste desta task cobre a rota com a camada de dados mockada — a query SQL em si se verifica manualmente no Step 8, com dados reais.

**Files:**
- Modify: `types/vehicle.ts` (fim do arquivo)
- Modify: `lib/db/vehicles.ts` (imports + nova função)
- Modify: `lib/db/transactions.ts` (nova função)
- Create: `app/api/transactions/pendentes/route.ts`
- Create: `tests/api/transactions-pendentes.test.ts`

**Interfaces:**
- Consumes: nada das tasks anteriores.
- Produces:
  - `interface PendingSale { id: number; brand: string; model: string; year: number; sale_price: number; primary_photo_url: string | null; updated_at: string }` em `@/types/vehicle`
  - `listPendingSales(tenantId: number): Promise<PendingSale[]>` em `@/lib/db`
  - `hasSaleTransaction(tenantId: number, vehicleId: number): Promise<boolean>` em `@/lib/db`
  - `GET /api/transactions/pendentes` → `PendingSale[]` em JSON

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/api/transactions-pendentes.test.ts`. Segue o padrão dos testes de rota do repo: mocka `@/lib/db` e `@/lib/api` (que arrasta next-auth pro grafo do módulo).

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const listPendingSales = vi.fn();

vi.mock("@/lib/db", () => ({ listPendingSales }));

// lib/api arrasta next-auth pro grafo do módulo. O withTenant falso injeta
// um tenantId fixo — o que importa aqui é o handler delegar com o tenant certo.
vi.mock("@/lib/api", () => ({
  ApiError: class extends Error {},
  withTenant:
    (handler: (req: unknown, ctx: { tenantId: number; params: Record<string, string> }) => unknown) =>
    (req: unknown) =>
      handler(req, { tenantId: 7, params: {} }),
}));

// `tsconfig.json` inclui **/*.ts, então o teste também é type-checked: a rota
// é tipada como (req, routeCtx) por causa do withTenant e precisa dos 2 args.
const req = () => ({ url: "http://x/api/transactions/pendentes" }) as never;
const ctx = { params: Promise.resolve({}) } as never;

const ONIX = {
  id: 1,
  brand: "Chevrolet",
  model: "Onix",
  year: 2022,
  sale_price: 79_900_00,
  primary_photo_url: null,
  updated_at: "2026-07-28T10:00:00.000Z",
};

describe("GET /api/transactions/pendentes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devolve as vendas pendentes do tenant da sessão", async () => {
    listPendingSales.mockResolvedValue([ONIX]);
    const { GET } = await import("@/app/api/transactions/pendentes/route");

    const res = await GET(req(), ctx);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([ONIX]);
    expect(listPendingSales).toHaveBeenCalledWith(7);
  });

  it("devolve lista vazia quando não há pendência", async () => {
    listPendingSales.mockResolvedValue([]);
    const { GET } = await import("@/app/api/transactions/pendentes/route");

    const res = await GET(req(), ctx);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run tests/api/transactions-pendentes.test.ts`
Expected: FAIL — não resolve `@/app/api/transactions/pendentes/route`.

- [ ] **Step 3: Declarar o tipo compartilhado**

No fim de `types/vehicle.ts`:

```ts
/**
 * Veículo marcado como vendido que ainda não tem transação de saída —
 * a venda existe no estoque, mas não no financeiro. Derivado por query,
 * não é estado gravado.
 */
export interface PendingSale {
  id: number;
  brand: string;
  model: string;
  year: number;
  sale_price: number;
  primary_photo_url: string | null;
  updated_at: string;
}
```

Fica em `types/` porque a página de Transações é client component e não pode importar valor de `@/lib/db`.

- [ ] **Step 4: Escrever a query das pendências**

Em `lib/db/vehicles.ts`, ajustar os imports do topo (linhas 2-4) para incluir `transactions` e o tipo novo:

```ts
import { transactions, vehicle_documents, vehicle_photos, vehicles } from "@/lib/schema";
import type { VehicleDocumentRow, VehiclePhotoRow, VehicleRow } from "@/lib/schema";
import type { PendingSale, VehicleInput, VehicleWithPhotos } from "@/types/vehicle";
```

E acrescentar a função logo depois de `listVehicles`:

```ts
/**
 * Vendas registradas no estoque mas não no financeiro: veículo com status
 * 'vendido' e sem transação 'saida'. Lista derivada de propósito — sai
 * sozinha quando a transação é criada ou quando o status volta atrás.
 */
export async function listPendingSales(tenantId: number): Promise<PendingSale[]> {
  return db
    .select({
      id: vehicles.id,
      brand: vehicles.brand,
      model: vehicles.model,
      year: vehicles.year,
      sale_price: vehicles.sale_price,
      primary_photo_url: vehicles.primary_photo_url,
      updated_at: vehicles.updated_at,
    })
    .from(vehicles)
    .where(
      and(
        eq(vehicles.tenant_id, tenantId),
        eq(vehicles.status, "vendido"),
        sql`NOT EXISTS (
          SELECT 1 FROM ${transactions} t
          WHERE t.tenant_id  = ${vehicles.tenant_id}
            AND t.vehicle_id = ${vehicles.id}
            AND t.type       = 'saida'
        )`,
      ),
    )
    .orderBy(desc(vehicles.updated_at));
}
```

- [ ] **Step 5: Escrever a checagem por veículo**

Em `lib/db/transactions.ts`, logo depois de `getTransaction`:

```ts
/** Já existe venda lançada para este veículo? Usado pra não pedir os dados duas vezes. */
export async function hasSaleTransaction(
  tenantId: number,
  vehicleId: number,
): Promise<boolean> {
  const [row] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.tenant_id, tenantId),
        eq(transactions.vehicle_id, vehicleId),
        eq(transactions.type, "saida"),
      ),
    )
    .limit(1);
  return !!row;
}
```

As duas funções já saem exportadas por `@/lib/db` — o barrel faz `export *` dos módulos.

- [ ] **Step 6: Criar a rota**

Criar `app/api/transactions/pendentes/route.ts`:

```ts
import { NextResponse } from "next/server";
import { listPendingSales } from "@/lib/db";
import { withTenant } from "@/lib/api";

export const GET = withTenant(async (_req, { tenantId }) => {
  const rows = await listPendingSales(tenantId);
  return NextResponse.json(rows);
});
```

- [ ] **Step 7: Rodar o teste e ver passar**

Run: `npx vitest run tests/api/transactions-pendentes.test.ts`
Expected: PASS, 2 testes.

Run: `npx tsc --noEmit`; depois `npm run lint 2>&1 | tail -3`; depois `npm test`
Expected: `tsc` sem nenhuma saída. `npm test` todo verde. O `npm run lint` **já falha na base deste repo** — 13 problemas (10 erros `react-hooks/set-state-in-effect` + 3 warnings), todos em arquivos pré-existentes. O gate do lint é *nenhum problema novo*: o total tem que continuar 13, e nenhum pode apontar para uma linha que você escreveu. Não conserte os erros pré-existentes — estão fora do escopo desta task.

- [ ] **Step 8: Verificar a query com dado real**

Com `npm run dev` e uma loja de teste:

1. Marcar um veículo como **Vendido** pelo formulário (`/admin/veiculos/<id>`) e salvar.
2. Abrir `http://localhost:3000/api/transactions/pendentes` logado como admin da loja.
   Expected: JSON com esse veículo.
3. Registrar uma transação de **Saída (venda)** desse veículo pelo botão "Nova transação" em `/admin/transacoes`.
4. Recarregar a URL do passo 2.
   Expected: `[]` — o veículo saiu da lista sozinho.

Se o passo 2 vier vazio, a `NOT EXISTS` está errada. Se o passo 4 ainda listar o veículo, o filtro por `type = 'saida'` está errado.

- [ ] **Step 9: Commit**

```bash
git add types/vehicle.ts lib/db/vehicles.ts lib/db/transactions.ts "app/api/transactions/pendentes/route.ts" tests/api/transactions-pendentes.test.ts
git commit -m "feat(admin): consulta e rota das vendas marcadas mas não lançadas"
```

---

### Task 5: O pop-up "Registrar venda"

Frente 1 do spec, passo 3. Componente novo, sem teste automatizado possível (vitest roda em Node, sem DOM) — a verificação é manual e está detalhada no Step 3.

O componente é **montado sob demanda** pelos dois callers (`{aberto && <RegistrarVendaModal .../>}`), seguindo o padrão do `TransactionSlideOver`. Por isso não tem prop `open`: montar na hora garante que o valor pré-preenchido seja o preço de venda atual, não um capturado antes.

**Files:**
- Create: `components/admin/RegistrarVendaModal.tsx`

**Interfaces:**
- Consumes: `computeCommission` de `@/lib/commission` (Task 3).
- Produces:
  - `RegistrarVendaModal({ vehicle, onClose, onSaved })` — component
  - `interface SaleVehicle { id: number; brand: string; model: string; year: number; sale_price: number }` exportada do mesmo arquivo. `PendingSale` (Task 4) é estruturalmente compatível e pode ser passado direto.

- [ ] **Step 1: Escrever o componente**

Criar `components/admin/RegistrarVendaModal.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import type { Seller } from "@/types/seller";
import { computeCommission } from "@/lib/commission";
import { centsToDisplay, displayToCents } from "@/lib/money";
import {
  Button, Field, Input, Modal, Select, Textarea, toast, type SelectOption,
} from "@/components/ui";

/** Dados mínimos do veículo — Vehicle e PendingSale atendem os dois. */
export interface SaleVehicle {
  id: number;
  brand: string;
  model: string;
  year: number;
  sale_price: number;
}

interface Props {
  vehicle: SaleVehicle;
  /** Fechou sem registrar — a venda vira pendência em Transações. */
  onClose: () => void;
  /** Registrou com sucesso. */
  onSaved: () => void;
}

// Radix Select não aceita "" como valor de Item — sentinela pra "sem vendedor".
const NONE_SELLER = "__none__";

export function RegistrarVendaModal({ vehicle, onClose, onSaved }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [amountStr,  setAmountStr]  = useState(centsToDisplay(vehicle.sale_price));
  const [date,       setDate]       = useState(today);
  const [buyerName,  setBuyerName]  = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [sellerId,   setSellerId]   = useState("");
  const [notes,      setNotes]      = useState("");
  const [sellers,    setSellers]    = useState<Seller[]>([]);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sellers")
      .then(r => r.json())
      .then((rows: Seller[]) => setSellers(rows.filter(s => s.status === "ativo")))
      .catch(() => {});
  }, []);

  const selectedSeller = sellers.find(s => String(s.id) === sellerId);
  const previewCommission = selectedSeller && amountStr
    ? computeCommission(displayToCents(amountStr), selectedSeller)
    : null;

  const sellerOptions: SelectOption[] = [
    { value: NONE_SELLER, label: "Sem vendedor" },
    ...sellers.map(s => ({ value: String(s.id), label: s.name })),
  ];

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id:  vehicle.id,
          type:        "saida",
          amount:      displayToCents(amountStr),
          date,
          buyer_name:  buyerName || null,
          buyer_phone: buyerPhone || null,
          seller_id:   sellerId ? Number(sellerId) : null,
          notes:       notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao registrar a venda");
      toast.success("Venda registrada.");
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleDismiss() {
    toast("Venda pendente. Você pode registrar depois em Transações.");
    onClose();
  }

  const label = `${vehicle.brand} ${vehicle.model} ${vehicle.year}`;

  return (
    <Modal
      open
      onOpenChange={(next) => { if (!next) handleDismiss(); }}
      size="xl"
      title="Registrar venda"
      description={`${label} foi marcado como vendido. Confirme os dados para lançar no financeiro.`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={handleDismiss}>
            Agora não
          </Button>
          <Button type="button" onClick={handleSubmit} loading={saving}>
            {saving ? "Registrando..." : "Registrar venda"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Valor da venda (R$)"
            required
            helperText={`Anunciado: R$ ${centsToDisplay(vehicle.sale_price)}`}
          >
            {(f) => (
              <Input
                id={f.id}
                required
                type="text"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                onBlur={() => setAmountStr(centsToDisplay(displayToCents(amountStr)))}
                placeholder="Ex: 79.900"
              />
            )}
          </Field>
          <Field label="Data da venda" required>
            {(f) => (
              <Input
                id={f.id}
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome do comprador">
            {(f) => (
              <Input
                id={f.id}
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Nome completo"
              />
            )}
          </Field>
          <Field label="Telefone do comprador">
            {(f) => (
              <Input
                id={f.id}
                type="tel"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                placeholder="82999990000"
              />
            )}
          </Field>
        </div>

        <Field
          label="Vendedor"
          helperText={previewCommission != null && previewCommission > 0
            ? `Comissão automática: R$ ${centsToDisplay(previewCommission)}`
            : undefined}
        >
          {(f) => (
            <Select
              id={f.id}
              value={sellerId || NONE_SELLER}
              onValueChange={(v) => setSellerId(v === NONE_SELLER ? "" : v)}
              options={sellerOptions}
            />
          )}
        </Field>

        <Field label="Observações">
          {(f) => (
            <Textarea
              id={f.id}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none"
            />
          )}
        </Field>

        {error && (
          <p className="text-body-s text-danger bg-danger/10 border border-danger/30 rounded-lg px-4 py-2">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Lint e types**

Run: `npx tsc --noEmit`; depois `npm run lint 2>&1 | tail -3`
Expected: `tsc` sem nenhuma saída. O `npm run lint` **já falha na base deste repo** — 13 problemas (10 erros `react-hooks/set-state-in-effect` + 3 warnings), todos em arquivos pré-existentes. O gate do lint é *nenhum problema novo*: o total tem que continuar 13, e nenhum pode apontar para uma linha que você escreveu. Não conserte os erros pré-existentes — estão fora do escopo desta task. O componente ainda não tem caller — é esperado; as Tasks 6 e 7 o ligam.

- [ ] **Step 3: Commit**

```bash
git add components/admin/RegistrarVendaModal.tsx
git commit -m "feat(admin): pop-up de registro de venda"
```

A verificação visual acontece na Task 6, quando o pop-up ganha o primeiro caller.

---

### Task 6: Disparar o pop-up ao marcar como vendido

Frente 1 do spec, passo 4. Aqui o fluxo fecha pela primeira vez.

**Files:**
- Modify: `components/admin/VehicleForm.tsx:16-18,31-33,102-106,123-126`
- Modify: `app/admin/(protected)/veiculos/[id]/page.tsx:2,18-22,42`

**Interfaces:**
- Consumes: `RegistrarVendaModal` (Task 5), `hasSaleTransaction` (Task 4).
- Produces: prop `hasSale?: boolean` em `VehicleForm`.

- [ ] **Step 1: Buscar `hasSale` no servidor**

Em `app/admin/(protected)/veiculos/[id]/page.tsx`, incluir `hasSaleTransaction` no import da linha 2:

```tsx
import {
  getDirectExpensesByVehicle, getDocumentsByVehicle, getVehicleWithPhotos, hasSaleTransaction,
} from "@/lib/db";
```

Adicionar a busca no `Promise.all` existente:

```tsx
  const [vehicle, documents, expenses, hasSale] = await Promise.all([
    getVehicleWithPhotos(tenant.id, vehicleId),
    getDocumentsByVehicle(tenant.id, vehicleId),
    getDirectExpensesByVehicle(tenant.id, vehicleId),
    hasSaleTransaction(tenant.id, vehicleId),
  ]);
```

E passar pro formulário:

```tsx
      <VehicleForm vehicle={vehicle} hasSale={hasSale} />
```

- [ ] **Step 2: Receber a prop e guardar o status inicial**

Em `components/admin/VehicleForm.tsx`, ajustar `Props` e a assinatura:

```tsx
interface Props {
  vehicle?: VehicleWithPhotos;
  /** Já existe transação de saída pra este veículo — não pedir os dados de novo. */
  hasSale?: boolean;
}
```

```tsx
export function VehicleForm({ vehicle, hasSale = false }: Props) {
```

Adicionar o import do pop-up junto dos outros de `./`:

```tsx
import { RegistrarVendaModal } from "./RegistrarVendaModal";
```

E, logo depois do `const [saving, setSaving]` / `const [error, setError]` (linhas 64-65):

```tsx
  // Status com que a tela abriu — é o que diz se a venda aconteceu *agora*.
  const [initialStatus] = useState(vehicle?.status ?? "disponivel");
  const [saleModal, setSaleModal] = useState(false);
```

- [ ] **Step 3: Abrir o pop-up depois de salvar**

Em `handleSubmit`, substituir o bloco das linhas 102-106:

```tsx
      if (!isEdit) {
        router.push(`/admin/veiculos/${data.id}`);
        return;
      }
      // Virou vendido agora e ainda não há venda lançada → pedir os dados
      // na hora, senão a venda some do financeiro.
      if (form.status === "vendido" && initialStatus !== "vendido" && !hasSale) {
        setSaleModal(true);
        return;
      }
      router.refresh();
```

O `finally { setSaving(false) }` continua rodando normalmente nos `return` antecipados.

- [ ] **Step 4: Renderizar o pop-up**

Dentro do `<form>`, logo depois de `{dialog}` (linha 125):

```tsx
      {isEdit && vehicle && saleModal && (
        <RegistrarVendaModal
          vehicle={{
            id: vehicle.id,
            brand: vehicle.brand,
            model: vehicle.model,
            year: vehicle.year,
            // form.sale_price, não vehicle.sale_price: pega o valor recém-salvo.
            sale_price: form.sale_price,
          }}
          onClose={() => { setSaleModal(false); router.refresh(); }}
          onSaved={() => { setSaleModal(false); router.refresh(); }}
        />
      )}
```

Montar sob demanda (`&& saleModal`) é o que garante o valor pré-preenchido correto.

- [ ] **Step 5: Lint, types e suíte**

Run: `npx tsc --noEmit`; depois `npm run lint 2>&1 | tail -3`; depois `npm test`
Expected: `tsc` sem nenhuma saída. `npm test` todo verde. O `npm run lint` **já falha na base deste repo** — 13 problemas (10 erros `react-hooks/set-state-in-effect` + 3 warnings), todos em arquivos pré-existentes. O gate do lint é *nenhum problema novo*: o total tem que continuar 13, e nenhum pode apontar para uma linha que você escreveu. Não conserte os erros pré-existentes — estão fora do escopo desta task.

- [ ] **Step 6: Verificar o fluxo feliz no navegador**

Com `npm run dev`, num veículo **disponível** que tenha vendedor ativo cadastrado:

1. Abrir `/admin/veiculos/<id>`, mudar Status para **Vendido**, salvar.
   Expected: o pop-up abre com o veículo no subtítulo e o valor já preenchido com o preço de venda.
2. Escolher um vendedor.
   Expected: aparece "Comissão automática: R$ ..." abaixo do campo.
3. Clicar em **Registrar venda**.
   Expected: toast "Venda registrada.", pop-up fecha.
4. Ir em `/admin/transacoes`.
   Expected: a venda aparece no histórico como **Saída**, e a comissão aparece como lançamento separado.
5. Voltar em `/admin/veiculos/<id>`, salvar de novo sem mudar nada.
   Expected: **nenhum** pop-up (o `hasSale` agora é true).

- [ ] **Step 7: Verificar o caminho da pendência**

Noutro veículo disponível:

1. Marcar como **Vendido** e salvar → pop-up abre.
2. Clicar em **Agora não**.
   Expected: toast "Venda pendente. Você pode registrar depois em Transações.", pop-up fecha, e o status na tela é Vendido.
3. Abrir `http://localhost:3000/api/transactions/pendentes`.
   Expected: o veículo está lá. (A faixa na tela chega na Task 7.)

- [ ] **Step 8: Commit**

```bash
git add components/admin/VehicleForm.tsx "app/admin/(protected)/veiculos/[id]/page.tsx"
git commit -m "feat(admin): pede os dados da venda ao marcar o veículo como vendido"
```

---

### Task 7: Faixa "Vendas a registrar" em Transações

Frente 1 do spec, passo 5 — a rede de segurança fica visível.

**Files:**
- Modify: `app/admin/(protected)/transacoes/page.tsx:1-10,29-49,68`

**Interfaces:**
- Consumes: `GET /api/transactions/pendentes` e `PendingSale` (Task 4), `RegistrarVendaModal` (Task 5).
- Produces: nada.

- [ ] **Step 1: Importar o que falta**

Em `app/admin/(protected)/transacoes/page.tsx`, acrescentar aos imports do topo:

```tsx
import { RegistrarVendaModal } from "@/components/admin/RegistrarVendaModal";
import type { PendingSale } from "@/types/vehicle";
```

- [ ] **Step 2: Carregar as pendências**

Adicionar os dois estados junto dos existentes (depois de `const [loading, setLoading]`):

```tsx
  const [pendentes,  setPendentes]  = useState<PendingSale[]>([]);
  const [registrar,  setRegistrar]  = useState<PendingSale | null>(null);
```

E incluir a busca no `Promise.all` do `load`:

```tsx
    const [tx, veh, dash, pend] = await Promise.all([
      fetch("/api/transactions").then(r => r.json()),
      fetch("/api/vehicles").then(r => r.json()),
      fetch("/api/dashboard").then(r => r.json()),
      fetch("/api/transactions/pendentes").then(r => r.json()),
    ]);
    setTransactions(tx);
    setVehicles(veh);
    setMonthly(dash.monthly ?? []);
    setPendentes(pend);
    setLoading(false);
```

- [ ] **Step 3: Renderizar a faixa**

Logo antes do bloco `{/* Monthly breakdown */}`:

```tsx
      {pendentes.length > 0 && (
        <section className="mb-6 rounded-xl border border-warning/40 bg-warning/10 overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-warning/30">
            <h2 className="font-display text-h3 font-semibold text-ink">
              Vendas a registrar ({pendentes.length})
            </h2>
            <p className="text-body-s text-n600 mt-0.5">
              Marcados como vendidos, mas ainda sem lançamento no financeiro.
            </p>
          </div>
          <ul className="divide-y divide-warning/30">
            {pendentes.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink truncate">
                    {p.brand} {p.model} {p.year}
                  </p>
                  <p className="text-xs text-n600">Anunciado por {formatBRL(p.sale_price)}</p>
                </div>
                <button
                  onClick={() => setRegistrar(p)}
                  className="shrink-0 inline-flex items-center gap-1.5 bg-ink text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-n800 transition-colors cursor-pointer"
                >
                  Registrar venda
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
```

- [ ] **Step 4: Ligar o pop-up**

No fim do componente, junto do `{slideOver && ...}` existente:

```tsx
      {registrar && (
        <RegistrarVendaModal
          vehicle={registrar}
          onClose={() => setRegistrar(null)}
          onSaved={() => { setRegistrar(null); load(); }}
        />
      )}
```

- [ ] **Step 5: Lint, types e suíte**

Run: `npx tsc --noEmit`; depois `npm run lint 2>&1 | tail -3`; depois `npm test`
Expected: `tsc` sem nenhuma saída. `npm test` todo verde. O `npm run lint` **já falha na base deste repo** — 13 problemas (10 erros `react-hooks/set-state-in-effect` + 3 warnings), todos em arquivos pré-existentes. O gate do lint é *nenhum problema novo*: o total tem que continuar 13, e nenhum pode apontar para uma linha que você escreveu. Não conserte os erros pré-existentes — estão fora do escopo desta task.

- [ ] **Step 6: Verificar o ciclo completo**

Com `npm run dev`, usando o veículo que ficou pendente na Task 6 (ou marcando outro como vendido e escolhendo "Agora não"):

1. Abrir `/admin/transacoes`.
   Expected: a faixa amarela "Vendas a registrar (N)" aparece **acima** de "Vendas por mês", listando o veículo com o preço anunciado.
2. Clicar em **Registrar venda** na faixa.
   Expected: abre o mesmo pop-up, com o valor pré-preenchido.
3. Confirmar.
   Expected: toast de sucesso, a faixa some (ou perde aquela linha), a venda aparece no "Histórico de transações" como Saída, e "Vendas por mês" reflete o lançamento.
4. Sem nenhuma pendência, recarregar a página.
   Expected: nenhuma faixa amarela — o bloco só existe quando há pendência.
5. Conferir em 1920px que a faixa acompanha o canvas centralizado da Task 1.

- [ ] **Step 7: Commit**

```bash
git add "app/admin/(protected)/transacoes/page.tsx"
git commit -m "feat(admin): faixa de vendas a registrar na tela de transações"
```

---

## Verificação final

- [ ] **Suíte completa**

Run: `npx tsc --noEmit`; depois `npm run lint 2>&1 | tail -3`; depois `npm test`
Expected: `tsc` sem nenhuma saída. `npm test` todo verde. O `npm run lint` **já falha na base deste repo** — 13 problemas (10 erros `react-hooks/set-state-in-effect` + 3 warnings), todos em arquivos pré-existentes. O gate do lint é *nenhum problema novo*: o total tem que continuar 13, e nenhum pode apontar para uma linha que você escreveu. Não conserte os erros pré-existentes — estão fora do escopo desta task.

- [ ] **Passada de aceitação no navegador**, com a loja de teste:

| Cenário | Esperado |
|---|---|
| Marcar veículo como vendido e confirmar no pop-up | Venda no histórico + comissão do vendedor lançada + veículo fora da fila |
| Marcar como vendido e clicar "Agora não" | Veículo vendido, faixa "Vendas a registrar" em Transações |
| Registrar pela faixa | Faixa some, venda aparece no financeiro |
| Salvar de novo um veículo que já tem venda | Nenhum pop-up |
| Lançar venda pelo botão "Nova transação" (fluxo antigo) | Funciona igual a antes, sem pop-up |
| `/admin/assinatura` | Nome do plano e status, sem preço |
| Painel em 1920px | Folga simétrica, tabelas mais largas, sidebar proporcional |
| Painel em 1440px e no mobile | Igual a antes |
