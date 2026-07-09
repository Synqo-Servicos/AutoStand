# Diagnósticos de pagamento no superadmin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar duas ferramentas de diagnóstico de pagamento no superadmin — um PIX avulso (valida credenciais MP + entrada de dinheiro) e um teste de fluxo completo de assinatura a R$1 (valida checkout→webhook→ativação de tenant).

**Architecture:** Duas API routes gated por `withSuperAdmin` que falam com o Mercado Pago server-side (onde o token de prod vive), mais uma página client no painel do superadmin que as consome. Reusa todas as funções de tenant/checkout existentes; não altera webhook nem liga o Checkout Transparente.

**Tech Stack:** Next.js (App Router), TypeScript, `mercadopago` v3.1.0, Drizzle, vitest.

## Global Constraints

- Ambas as rotas gated por `withSuperAdmin` de `@/lib/api` (401 se não for `super_admin`).
- `MERCADOPAGO_ACCESS_TOKEN` ausente → responder **503** com `ApiError`, nunca 500 genérico.
- PIX de diagnóstico: `transaction_amount: 0.01`, `payment_method_id: "pix"`, `payer.email: "diagnostico@autostand.com.br"`.
- Fluxo completo: cobrança **R$1,00** via cupom sintético em memória `{ discount_type: "fixed", discount_value: 16890 }` (16990 − 16890 = 100 centavos). Nunca persistir esse cupom.
- Tenants de diagnóstico: slug com prefixo `diag-`, `status: "suspended"`, `subscription_status: "incomplete"`.
- **Não** alterar `app/api/webhooks/mercadopago/route.ts`. **Não** setar `CHECKOUT_MODE`.
- Testes em `tests/api/` (vitest), MP e DB mockados.

---

### Task 1: Rota PIX de diagnóstico

**Files:**
- Create: `app/api/superadmin/pix-teste/route.ts`
- Test: `tests/api/superadmin-pix-teste.test.ts`

**Interfaces:**
- Consumes: `withSuperAdmin`, `ApiError` de `@/lib/api`; `MercadoPagoConfig` (default), `Payment` de `mercadopago`.
- Produces:
  - `POST` → 201 `{ id: string, status: string, amount: number, qrCode: string, qrCodeBase64: string, ticketUrl: string }`
  - `GET ?id=<paymentId>` → 200 `{ id: string, status: string, statusDetail: string | null }`
  - Token ausente → 503 `{ error: string }`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/superadmin-pix-teste.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const paymentCreate = vi.fn();
const paymentGet = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "1", role: "super_admin" } })),
  getApiTenantId: vi.fn(),
}));
vi.mock("mercadopago", () => ({
  default: class MercadoPagoConfig {
    constructor(_opts: unknown) {}
  },
  Payment: class {
    create = paymentCreate;
    get = paymentGet;
  },
}));

function req(url = "http://x/api/superadmin/pix-teste", body?: unknown) {
  return { url, json: async () => body, headers: new Headers() } as never;
}
const ctx = { params: Promise.resolve({}) } as never;

describe("superadmin/pix-teste", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST-TOKEN";
  });

  it("POST cria PIX e devolve QR + copia-e-cola", async () => {
    paymentCreate.mockResolvedValue({
      id: 123,
      status: "pending",
      point_of_interaction: {
        transaction_data: {
          qr_code: "000201COPIA",
          qr_code_base64: "BASE64==",
          ticket_url: "https://mp/ticket",
        },
      },
    });
    const { POST } = await import("@/app/api/superadmin/pix-teste/route");
    const res = await POST(req(), ctx);
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json).toMatchObject({
      id: "123",
      status: "pending",
      amount: 0.01,
      qrCode: "000201COPIA",
      qrCodeBase64: "BASE64==",
      ticketUrl: "https://mp/ticket",
    });
    expect(paymentCreate).toHaveBeenCalledWith({
      body: {
        transaction_amount: 0.01,
        description: "AutoStand — diagnóstico de pagamento",
        payment_method_id: "pix",
        payer: { email: "diagnostico@autostand.com.br" },
      },
    });
  });

  it("GET ?id devolve status", async () => {
    paymentGet.mockResolvedValue({ id: 123, status: "approved", status_detail: "accredited" });
    const { GET } = await import("@/app/api/superadmin/pix-teste/route");
    const res = await GET(req("http://x/api/superadmin/pix-teste?id=123"), ctx);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ id: "123", status: "approved", statusDetail: "accredited" });
    expect(paymentGet).toHaveBeenCalledWith({ id: "123" });
  });

  it("POST sem token → 503", async () => {
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    const { POST } = await import("@/app/api/superadmin/pix-teste/route");
    const res = await POST(req(), ctx);
    expect(res.status).toBe(503);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/superadmin-pix-teste.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/superadmin/pix-teste/route'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/api/superadmin/pix-teste/route.ts
import { NextResponse } from "next/server";
import MercadoPagoConfig, { Payment } from "mercadopago";
import { ApiError, withSuperAdmin } from "@/lib/api";

const DIAG_EMAIL = "diagnostico@autostand.com.br";

function mpPayment(): Payment {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) throw new ApiError("MERCADOPAGO_ACCESS_TOKEN não configurado.", 503);
  return new Payment(new MercadoPagoConfig({ accessToken }));
}

export const POST = withSuperAdmin(async () => {
  const payment = mpPayment();
  const result = await payment.create({
    body: {
      transaction_amount: 0.01,
      description: "AutoStand — diagnóstico de pagamento",
      payment_method_id: "pix",
      payer: { email: DIAG_EMAIL },
    },
  });
  const td = result.point_of_interaction?.transaction_data;
  return NextResponse.json(
    {
      id: String(result.id),
      status: result.status,
      amount: 0.01,
      qrCode: td?.qr_code ?? "",
      qrCodeBase64: td?.qr_code_base64 ?? "",
      ticketUrl: td?.ticket_url ?? "",
    },
    { status: 201 },
  );
});

export const GET = withSuperAdmin(async (req) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) throw new ApiError("Parâmetro 'id' obrigatório.", 400);
  const result = await mpPayment().get({ id });
  return NextResponse.json({
    id: String(result.id),
    status: result.status,
    statusDetail: result.status_detail ?? null,
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/superadmin-pix-teste.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/superadmin/pix-teste/route.ts tests/api/superadmin-pix-teste.test.ts
git commit -m "feat(superadmin): rota de diagnóstico PIX (valida credenciais MP)"
```

---

### Task 2: Rota de fluxo completo (assinatura R$1)

**Files:**
- Create: `app/api/superadmin/fluxo-teste/route.ts`
- Test: `tests/api/superadmin-fluxo-teste.test.ts`

**Interfaces:**
- Consumes: `withSuperAdmin`, `ApiError` de `@/lib/api`; `createTenant`, `getTenantById`, `deleteTenant` de `@/lib/db`; `createCheckoutSession`, `cancelMpSubscription` de `@/lib/checkout`; `getPlan` de `@/lib/plans`; `CouponRow` de `@/lib/schema`.
- Produces:
  - `POST` → 201 `{ tenantId: number, slug: string, checkoutUrl: string }`
  - `GET ?tenantId=<id>` → 200 `{ subscription_status: string | null, mp_subscription_id: string | null }`
  - `DELETE ?tenantId=<id>` → 200 `{ ok: true }`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/superadmin-fluxo-teste.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const createTenant = vi.fn();
const getTenantById = vi.fn();
const deleteTenant = vi.fn();
const createCheckoutSession = vi.fn();
const cancelMpSubscription = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "9", role: "super_admin" } })),
  getApiTenantId: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ createTenant, getTenantById, deleteTenant }));
vi.mock("@/lib/checkout", () => ({ createCheckoutSession, cancelMpSubscription }));

function req(url = "http://x/api/superadmin/fluxo-teste", body?: unknown) {
  return { url, json: async () => body, headers: new Headers() } as never;
}
const ctx = { params: Promise.resolve({}) } as never;

describe("superadmin/fluxo-teste", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createTenant.mockResolvedValue({ id: 7, slug: "diag-abc" });
    createCheckoutSession.mockResolvedValue("https://mp/checkout");
  });

  it("POST cria tenant diag- e checkout a R$1 (cupom fixed 16890)", async () => {
    const { POST } = await import("@/app/api/superadmin/fluxo-teste/route");
    const res = await POST(req(), ctx);
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json).toEqual({ tenantId: 7, slug: "diag-abc", checkoutUrl: "https://mp/checkout" });

    const tenantArg = createTenant.mock.calls[0][0];
    expect(tenantArg.slug).toMatch(/^diag-/);
    expect(tenantArg.name).toBe("Diagnóstico");

    const couponArg = createCheckoutSession.mock.calls[0][3];
    expect(couponArg).toMatchObject({ discount_type: "fixed", discount_value: 16890 });
  });

  it("GET ?tenantId devolve status da assinatura", async () => {
    getTenantById.mockResolvedValue({ subscription_status: "active", mp_subscription_id: "sub_1" });
    const { GET } = await import("@/app/api/superadmin/fluxo-teste/route");
    const res = await GET(req("http://x/api/superadmin/fluxo-teste?tenantId=7"), ctx);
    const json = await res.json();
    expect(json).toEqual({ subscription_status: "active", mp_subscription_id: "sub_1" });
    expect(getTenantById).toHaveBeenCalledWith(7);
  });

  it("DELETE cancela assinatura (se houver) e apaga o tenant", async () => {
    getTenantById.mockResolvedValue({ id: 7, mp_subscription_id: "sub_1" });
    const { DELETE } = await import("@/app/api/superadmin/fluxo-teste/route");
    const res = await DELETE(req("http://x/api/superadmin/fluxo-teste?tenantId=7"), ctx);
    expect(res.status).toBe(200);
    expect(cancelMpSubscription).toHaveBeenCalledWith("sub_1");
    expect(deleteTenant).toHaveBeenCalledWith(7);
  });

  it("DELETE sem mp_subscription_id não cancela, mas apaga", async () => {
    getTenantById.mockResolvedValue({ id: 7, mp_subscription_id: null });
    const { DELETE } = await import("@/app/api/superadmin/fluxo-teste/route");
    await DELETE(req("http://x/api/superadmin/fluxo-teste?tenantId=7"), ctx);
    expect(cancelMpSubscription).not.toHaveBeenCalled();
    expect(deleteTenant).toHaveBeenCalledWith(7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/superadmin-fluxo-teste.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/api/superadmin/fluxo-teste/route.ts
import { NextResponse } from "next/server";
import { ApiError, withSuperAdmin } from "@/lib/api";
import { createTenant, getTenantById, deleteTenant } from "@/lib/db";
import { createCheckoutSession, cancelMpSubscription } from "@/lib/checkout";
import { getPlan } from "@/lib/plans";
import type { CouponRow, TenantRow } from "@/lib/schema";

/** Cupom sintético (não persistido) que derruba o Básico p/ R$1,00. */
function diagCoupon(userId: number): CouponRow {
  return {
    id: -1,
    code: "DIAG",
    description: "diagnóstico",
    discount_type: "fixed",
    discount_value: 16890,
    max_uses: 1,
    used_count: 0,
    expires_at: null,
    partner_id: null,
    created_by: userId,
    created_at: "",
  } as CouponRow;
}

function tenantIdParam(req: Request): number {
  const raw = new URL(req.url).searchParams.get("tenantId");
  const n = raw ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n <= 0) throw new ApiError("Parâmetro 'tenantId' inválido.", 400);
  return n;
}

export const POST = withSuperAdmin(async (_req, { userId }) => {
  const slug = `diag-${Date.now().toString(36)}`;
  const tenant = await createTenant({
    slug,
    name: "Diagnóstico",
    plan: "basico",
    status: "suspended",
    subscription_status: "incomplete",
  });
  const checkoutUrl = await createCheckoutSession(
    tenant,
    getPlan("basico"),
    null,
    diagCoupon(userId),
  );
  return NextResponse.json(
    { tenantId: tenant.id, slug: tenant.slug, checkoutUrl },
    { status: 201 },
  );
});

export const GET = withSuperAdmin(async (req) => {
  const tenant = await getTenantById(tenantIdParam(req));
  if (!tenant) throw new ApiError("Tenant não encontrado.", 404);
  return NextResponse.json({
    subscription_status: tenant.subscription_status,
    mp_subscription_id: tenant.mp_subscription_id,
  });
});

export const DELETE = withSuperAdmin(async (req) => {
  const id = tenantIdParam(req);
  const tenant = await getTenantById(id);
  if (tenant?.mp_subscription_id) {
    await cancelMpSubscription(tenant.mp_subscription_id);
  }
  await deleteTenant(id);
  return NextResponse.json({ ok: true });
});
```

> Nota: o campo `created_at` de `CouponRow` é tipado como `string`; usamos `"" as CouponRow` via cast do objeto inteiro porque `createCheckoutSession` só lê `discount_type`/`discount_value`. Se o tsc reclamar de campos faltando, o cast `as CouponRow` no return já cobre.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/superadmin-fluxo-teste.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. Se `diagCoupon` acusar campos faltando, ajustar o objeto ao shape real de `CouponRow` (rodar `npx tsc --noEmit` mostra os nomes exatos) mantendo `discount_type: "fixed"` e `discount_value: 16890`.

- [ ] **Step 6: Commit**

```bash
git add app/api/superadmin/fluxo-teste/route.ts tests/api/superadmin-fluxo-teste.test.ts
git commit -m "feat(superadmin): rota de teste de fluxo completo de assinatura (R\$1)"
```

---

### Task 3: Página de diagnóstico + entrada no menu

**Files:**
- Create: `app/superadmin/(panel)/diagnostico/page.tsx`
- Create: `components/superadmin/PaymentDiagnostics.tsx`
- Modify: `components/superadmin/SuperAdminSidebar.tsx` (adicionar item ao `NAV`)

**Interfaces:**
- Consumes: rotas `POST/GET /api/superadmin/pix-teste` e `POST/GET/DELETE /api/superadmin/fluxo-teste` (Tasks 1–2).
- Produces: rota navegável `/superadmin/diagnostico`.

- [ ] **Step 1: Adicionar item no menu**

Em `components/superadmin/SuperAdminSidebar.tsx`, importar o ícone e adicionar ao `NAV`:

```typescript
// no import de lucide-react, acrescentar Stethoscope:
import { Building2, Handshake, LayoutDashboard, LogOut, Menu, Stethoscope, Tag, X } from "lucide-react";

const NAV = [
  { href: "/superadmin/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/superadmin/tenants", label: "Concessionárias", icon: Building2 },
  { href: "/superadmin/parceiros", label: "Parceiros", icon: Handshake },
  { href: "/superadmin/cupons", label: "Cupons", icon: Tag },
  { href: "/superadmin/diagnostico", label: "Diagnóstico", icon: Stethoscope },
];
```

- [ ] **Step 2: Criar o componente client**

```typescript
// components/superadmin/PaymentDiagnostics.tsx
"use client";

import { useState } from "react";

type Pix = { id: string; status: string; qrCode: string; qrCodeBase64: string; ticketUrl: string };
type Flow = { tenantId: number; slug: string; checkoutUrl: string };

export function PaymentDiagnostics() {
  const [pix, setPix] = useState<Pix | null>(null);
  const [pixStatus, setPixStatus] = useState<string | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [flowStatus, setFlowStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(url: string, method: string) {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(url, { method });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`);
      return json;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro inesperado.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {err && <p className="text-red-600 text-sm">{err}</p>}

      <section className="rounded-lg border border-n200 p-5 space-y-3">
        <h2 className="font-semibold">PIX rápido (credenciais + dinheiro)</h2>
        <button
          disabled={busy}
          onClick={async () => {
            const j = await call("/api/superadmin/pix-teste", "POST");
            if (j) { setPix(j); setPixStatus(j.status); }
          }}
          className="rounded-md bg-ink text-white px-4 py-2 text-sm disabled:opacity-50 cursor-pointer"
        >
          Gerar PIX de teste (R$0,01)
        </button>
        {pix && (
          <div className="space-y-2 text-sm">
            {pix.qrCodeBase64 && (
              <img
                alt="QR do PIX"
                src={`data:image/png;base64,${pix.qrCodeBase64}`}
                className="w-40 h-40"
              />
            )}
            <label className="block">Copia-e-cola:</label>
            <textarea readOnly value={pix.qrCode} className="w-full border border-n200 rounded p-2 text-xs" rows={3} />
            <button
              onClick={() => navigator.clipboard.writeText(pix.qrCode)}
              className="text-signal underline cursor-pointer"
            >
              Copiar
            </button>
            <p>Payment id: <code>{pix.id}</code></p>
            <button
              disabled={busy}
              onClick={async () => {
                const j = await call(`/api/superadmin/pix-teste?id=${pix.id}`, "GET");
                if (j) setPixStatus(j.status);
              }}
              className="rounded-md border border-n300 px-3 py-1.5 disabled:opacity-50 cursor-pointer"
            >
              Atualizar status
            </button>
            <p>Status: <strong>{pixStatus}</strong></p>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-n200 p-5 space-y-3">
        <h2 className="font-semibold">Fluxo completo de assinatura (R$1)</h2>
        <button
          disabled={busy}
          onClick={async () => {
            const j = await call("/api/superadmin/fluxo-teste", "POST");
            if (j) { setFlow(j); setFlowStatus(null); }
          }}
          className="rounded-md bg-ink text-white px-4 py-2 text-sm disabled:opacity-50 cursor-pointer"
        >
          Iniciar teste (R$1)
        </button>
        {flow && (
          <div className="space-y-2 text-sm">
            <p>Tenant de teste: <code>{flow.slug}</code></p>
            <a href={flow.checkoutUrl} target="_blank" rel="noreferrer" className="text-signal underline">
              Abrir checkout do MP →
            </a>
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={async () => {
                  const j = await call(`/api/superadmin/fluxo-teste?tenantId=${flow.tenantId}`, "GET");
                  if (j) setFlowStatus(j.subscription_status ?? "—");
                }}
                className="rounded-md border border-n300 px-3 py-1.5 disabled:opacity-50 cursor-pointer"
              >
                Atualizar status
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  const j = await call(`/api/superadmin/fluxo-teste?tenantId=${flow.tenantId}`, "DELETE");
                  if (j) { setFlow(null); setFlowStatus(null); }
                }}
                className="rounded-md border border-red-300 text-red-600 px-3 py-1.5 disabled:opacity-50 cursor-pointer"
              >
                Limpar (cancelar + apagar tenant)
              </button>
            </div>
            <p>Status do tenant: <strong>{flowStatus ?? "—"}</strong></p>
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Criar a página**

```typescript
// app/superadmin/(panel)/diagnostico/page.tsx
import { PaymentDiagnostics } from "@/components/superadmin/PaymentDiagnostics";

export const metadata = { title: "Diagnóstico — Plataforma" };

export default function DiagnosticoPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-1">Diagnóstico de pagamentos</h1>
      <p className="text-n600 text-sm mb-6">
        Ferramentas para validar o processamento de pagamentos em produção.
      </p>
      <PaymentDiagnostics />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck + build sanity**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors (atenção ao `<img>` — se o eslint do projeto exigir `next/image`, trocar por `next/image` com `width={160} height={160}` e `unoptimized`).

- [ ] **Step 5: Verificação manual (local)**

Run: `npm run dev`, logar como `super_admin`, abrir `/superadmin/diagnostico`.
Expected: menu mostra "Diagnóstico"; a página renderiza as duas seções; os botões chamam as rotas (com token de MP local/sandbox, o PIX gera QR; sem token → toast de erro 503). Confirma que nenhuma outra tela quebrou.

- [ ] **Step 6: Commit**

```bash
git add app/superadmin/\(panel\)/diagnostico/page.tsx components/superadmin/PaymentDiagnostics.tsx components/superadmin/SuperAdminSidebar.tsx
git commit -m "feat(superadmin): página de diagnóstico de pagamentos (PIX + fluxo completo)"
```

---

## Self-Review

**1. Spec coverage:**
- PIX rápido (route POST/GET, R$0,01, payer fixo, 503) → Task 1. ✅
- Fluxo completo (tenant descartável diag-, checkout R$1 via cupom sintético, status, cleanup cancel+delete) → Task 2. ✅
- Página superadmin + menu, duas seções, QR/copia-e-cola, botões de status e limpar → Task 3. ✅
- Webhook não alterado / transparente OFF → nenhuma task toca esses arquivos. ✅
- Testes em tests/api/ com mocks → Tasks 1–2. ✅

**2. Placeholder scan:** Sem TBD/TODO; todo passo com código ou comando concreto. ✅

**3. Type consistency:** `qrCode`/`qrCodeBase64`/`ticketUrl`/`statusDetail` consistentes entre rota, teste e componente; `tenantId`/`slug`/`checkoutUrl` idem; cupom sintético usa `discount_type: "fixed"`, `discount_value: 16890` em plano, teste e código. ✅

## Notas de execução

- A ferramenta 2 cria **assinatura recorrente real** — o botão "Limpar" (cancelar) é obrigatório após o teste.
- Se o MP recusar R$1,00 por mínimo próprio, ajustar `discount_value` do cupom sintético para `16490` (R$5,00).
- O `<img>` base64 pode disparar regra `@next/next/no-img-element` do eslint — o Step 4 já prevê a troca por `next/image` se necessário.
