# Checkout Transparente do Mercado Pago — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o lojista assine pagando com cartão na própria tela do AutoStand (Checkout Transparente), sem precisar de conta/login Mercado Pago/Livre.

**Architecture:** Fluxo em duas etapas. O `/assinar` continua criando o tenant `incomplete` e passa a devolver um token de pagamento assinado (HMAC). Uma página `/assinar/pagamento` renderiza o Card Payment Brick do MP (SDK no navegador), tokeniza o cartão e chama `/api/assinar/pagamento`, que cria o `PreApproval` via API com o `card_token` e ativa o tenant. O redirect atual permanece como fallback, selecionado por `CHECKOUT_MODE`.

**Tech Stack:** Next.js 16.2.4 (App Router), React 19, TypeScript, Vitest, Drizzle (Postgres), SDK `mercadopago` (server) + `@mercadopago/sdk-react` (client), HMAC via `node:crypto`.

## Global Constraints

- **Valores monetários em centavos** em todo o backend (`plan.priceMonthly = 16990` = R$169,90); o MP recebe em **reais** (`centavos / 100`).
- **`NEXT_PUBLIC_*` é inlined em BUILD time** no build standalone do Next — precisa existir como `--build-arg` no `docker build`, não só em runtime (mesmo padrão do `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `Dockerfile:16-17`).
- **PCI SAQ-A:** o número do cartão (PAN) só existe no navegador via Brick. O backend recebe apenas o `card_token`. **Nunca logar nem persistir dados de cartão.**
- **Não quebrar o redirect:** `CHECKOUT_MODE` default = `redirect` (comportamento atual de lançamento). Só `CHECKOUT_MODE=transparent` liga o novo fluxo.
- **Cópia voltada ao usuário em português.**
- **Testes:** Vitest, `environment: "node"`, arquivos em `tests/**/*.test.ts`, alias `@/` → raiz. Rodar um arquivo: `npx vitest run tests/<caminho>`. Suite: `npm test`.
- **Commits:** seguir o estilo do repositório (`feat(...)`, `test(...)`), em português. **Nunca adicionar linhas `Co-Authored-By`.**

---

### Task 1: Módulo de token de pagamento assinado (`lib/payment-token.ts`)

Token curto HMAC que autoriza a etapa de pagamento a agir sobre um tenant específico (o lojista ainda não tem sessão). Função pura, testável. **Não** importa `server-only` (o vitest roda em `node` sem stub — importar quebraria o teste); o segredo é lido em tempo de chamada.

**Files:**
- Create: `lib/payment-token.ts`
- Test: `tests/lib/payment-token.test.ts`

**Interfaces:**
- Consumes: `node:crypto` (`createHmac`, `timingSafeEqual`), `process.env.PAYMENT_TOKEN_SECRET`.
- Produces:
  - `interface PaymentTokenPayload { tenantId: number; planSlug: string; couponId: number | null }`
  - `signPaymentToken(payload: PaymentTokenPayload, nowSeconds?: number): string`
  - `verifyPaymentToken(token: string, nowSeconds?: number): PaymentTokenPayload | null`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/payment-token.test.ts
import { describe, it, expect, beforeEach } from "vitest";

describe("payment-token", () => {
  beforeEach(() => {
    process.env.PAYMENT_TOKEN_SECRET = "test-secret";
  });

  it("assina e verifica um payload válido dentro do prazo", async () => {
    const { signPaymentToken, verifyPaymentToken } = await import("@/lib/payment-token");
    const now = 1_000_000;
    const token = signPaymentToken({ tenantId: 7, planSlug: "basico", couponId: 3 }, now);
    expect(verifyPaymentToken(token, now + 60)).toEqual({ tenantId: 7, planSlug: "basico", couponId: 3 });
  });

  it("rejeita token expirado (> 30 min)", async () => {
    const { signPaymentToken, verifyPaymentToken } = await import("@/lib/payment-token");
    const now = 1_000_000;
    const token = signPaymentToken({ tenantId: 7, planSlug: "basico", couponId: null }, now);
    expect(verifyPaymentToken(token, now + 30 * 60 + 1)).toBeNull();
  });

  it("rejeita assinatura adulterada", async () => {
    const { signPaymentToken, verifyPaymentToken } = await import("@/lib/payment-token");
    const now = 1_000_000;
    const token = signPaymentToken({ tenantId: 7, planSlug: "basico", couponId: null }, now);
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect(verifyPaymentToken(tampered, now + 1)).toBeNull();
  });

  it("rejeita formato inválido", async () => {
    const { verifyPaymentToken } = await import("@/lib/payment-token");
    expect(verifyPaymentToken("garbage", 1)).toBeNull();
    expect(verifyPaymentToken("", 1)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/payment-token.test.ts`
Expected: FAIL — `Cannot find module '@/lib/payment-token'`.

- [ ] **Step 3: Write the minimal implementation**

```ts
// lib/payment-token.ts
import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_SECONDS = 30 * 60; // 30 minutos

export interface PaymentTokenPayload {
  tenantId: number;
  planSlug: string;
  couponId: number | null;
}

interface SignedPayload extends PaymentTokenPayload {
  exp: number; // unix seconds
}

function secret(): string {
  const s = process.env.PAYMENT_TOKEN_SECRET;
  if (!s) throw new Error("PAYMENT_TOKEN_SECRET não configurado.");
  return s;
}

function nowS(nowSeconds?: number): number {
  return nowSeconds ?? Math.floor(Date.now() / 1000);
}

export function signPaymentToken(payload: PaymentTokenPayload, nowSeconds?: number): string {
  const body: SignedPayload = { ...payload, exp: nowS(nowSeconds) + TTL_SECONDS };
  const data = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyPaymentToken(token: string, nowSeconds?: number): PaymentTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = createHmac("sha256", secret()).update(data).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  let parsed: SignedPayload;
  try {
    parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof parsed.exp !== "number" || parsed.exp < nowS(nowSeconds)) return null;
  return { tenantId: parsed.tenantId, planSlug: parsed.planSlug, couponId: parsed.couponId ?? null };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/payment-token.test.ts`
Expected: PASS (4 passing).

- [ ] **Step 5: Commit**

```bash
git add lib/payment-token.ts tests/lib/payment-token.test.ts
git commit -m "feat(checkout): token de pagamento assinado (HMAC) para o fluxo transparente"
```

---

### Task 2: `createTransparentSubscription` em `lib/checkout.ts`

Cria o `PreApproval` via API com `card_token` (sem redirect). Reusa `discountedPriceCents`. Inclui um refactor DRY: extrai `subscriptionReason()` e `autoRecurringBody()` (hoje inline em `createMpPlan`) e reaproveita nos dois. O output do `createMpPlan` fica idêntico — os testes existentes continuam passando.

**Files:**
- Modify: `lib/checkout.ts`
- Modify (test): `tests/lib/checkout.test.ts`

**Interfaces:**
- Consumes: `discountedPriceCents` (`@/lib/coupon-pricing`), `tenantSiteUrl` (`@/lib/marketplace`), `PreApproval` (`mercadopago`), `getMpClient()` (privado, mesmo arquivo).
- Produces:
  - `interface TransparentSubscriptionResult { id: string; status: string; statusDetail: string | null }`
  - `createTransparentSubscription(tenant: TenantRow, plan: Plan, coupon: CouponRow | null, cardToken: string, payerEmail: string): Promise<TransparentSubscriptionResult>`

- [ ] **Step 1: Write the failing test** (adiciona ao arquivo existente)

Primeiro, no topo do `tests/lib/checkout.test.ts`, adicione um mock estável do `PreApproval.create` (o mock atual devolve um `vi.fn()` novo a cada chamada, inutilizável para asserção). Substitua o factory do `PreApproval`:

```ts
// no topo, junto de `const mockPlanCreate = vi.fn();`
const mockPreApprovalCreate = vi.fn();

// dentro do vi.mock("mercadopago", ...), troque a função PreApproval por:
  function PreApproval() {
    return { create: mockPreApprovalCreate, update: vi.fn() };
  }
```

Depois acrescente o bloco de teste ao final do arquivo:

```ts
describe("createTransparentSubscription", () => {
  beforeEach(() => {
    mockPreApprovalCreate.mockReset();
    mockPreApprovalCreate.mockResolvedValue({ id: "sub_123", status: "authorized", status_detail: "accredited" });
    process.env.MERCADOPAGO_ACCESS_TOKEN = "test-token";
  });

  it("cria PreApproval com card_token, e-mail, status authorized e valor com cupom fixo", async () => {
    const { createTransparentSubscription } = await import("@/lib/checkout");
    const res = await createTransparentSubscription(TENANT, PLAN, makeCoupon("fixed", 16890), "card_tok_abc", "comprador@teste.com");
    const body = mockPreApprovalCreate.mock.calls[0][0].body;
    expect(body.card_token_id).toBe("card_tok_abc");
    expect(body.payer_email).toBe("comprador@teste.com");
    expect(body.status).toBe("authorized");
    expect(body.external_reference).toBe("1");
    expect(body.auto_recurring.transaction_amount).toBeCloseTo(1.0, 2); // 16990-16890 = 100c = R$1,00
    expect(body.back_url).toMatch(/^https:\/\/autoprime\..+\/admin\/assinatura$/);
    expect(res).toEqual({ id: "sub_123", status: "authorized", statusDetail: "accredited" });
  });

  it("free_month vira free_trial com mensalidade cheia", async () => {
    const { createTransparentSubscription } = await import("@/lib/checkout");
    await createTransparentSubscription(TENANT, PLAN, makeCoupon("free_month", null), "tok", "c@t.com");
    const body = mockPreApprovalCreate.mock.calls[0][0].body;
    expect(body.auto_recurring.free_trial).toEqual({ frequency: 1, frequency_type: "months" });
    expect(body.auto_recurring.transaction_amount).toBeCloseTo(169.9, 1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/checkout.test.ts`
Expected: FAIL — `createTransparentSubscription is not a function` (os testes do `createCheckoutSession` continuam passando).

- [ ] **Step 3: Write the implementation** (refactor + nova função)

No `lib/checkout.ts`, adicione os dois helpers privados (logo após `getMpClient`) e reaproveite-os em `createMpPlan`:

```ts
function subscriptionReason(plan: Plan, coupon: CouponRow | null): string {
  if (!coupon) return `AutoStand ${plan.name}`;
  if (coupon.discount_type === "percentage") return `AutoStand ${plan.name} — ${coupon.discount_value}% de desconto`;
  if (coupon.discount_type === "free_month") return `AutoStand ${plan.name} — 1º mês grátis`;
  return `AutoStand ${plan.name} — desconto especial`;
}

function autoRecurringBody(plan: Plan, coupon: CouponRow | null): Record<string, unknown> {
  const priceCents = coupon ? discountedPriceCents(plan, coupon) : plan.priceMonthly;
  const body: Record<string, unknown> = {
    frequency: 1,
    frequency_type: "months",
    transaction_amount: Math.max(1, priceCents) / 100, // piso de código; MP tem mínimo próprio
    currency_id: "BRL",
  };
  if (coupon?.discount_type === "free_month") {
    body.free_trial = { frequency: 1, frequency_type: "months" };
  }
  return body;
}
```

Em `createMpPlan`, substitua a montagem inline de `reason` e `autoRecurring` por `subscriptionReason(plan, coupon)` e `autoRecurringBody(plan, coupon)` (mantendo o resto igual — inclusive o `back_url`).

Adicione a nova função (e o tipo) ao final do arquivo:

```ts
export interface TransparentSubscriptionResult {
  id: string;
  status: string;
  statusDetail: string | null;
}

/**
 * Checkout Transparente: cria o PreApproval direto via API com um card_token
 * tokenizado no navegador (Card Brick). O pagador não precisa de conta MP.
 * Retorna o status já resolvido (authorized/pending/rejected).
 */
export async function createTransparentSubscription(
  tenant: TenantRow,
  plan: Plan,
  coupon: CouponRow | null,
  cardToken: string,
  payerEmail: string,
): Promise<TransparentSubscriptionResult> {
  const preApproval = new PreApproval(getMpClient());
  const res = await preApproval.create({
    body: {
      reason: subscriptionReason(plan, coupon),
      external_reference: String(tenant.id),
      payer_email: payerEmail,
      card_token_id: cardToken,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      auto_recurring: autoRecurringBody(plan, coupon) as any,
      back_url: `${tenantSiteUrl(tenant)}/admin/assinatura`,
      status: "authorized",
    },
  });

  if (!res.id) throw new Error("MP did not return a preapproval id");
  return {
    id: String(res.id),
    status: String(res.status ?? "pending"),
    statusDetail: (res as { status_detail?: string }).status_detail ?? null,
  };
}
```

Garanta que `Plan`, `CouponRow`, `TenantRow` já estão importados no topo (o arquivo já importa `Plan` e os tipos de `@/lib/schema`).

- [ ] **Step 4: Run the tests to verify they pass (incluindo os antigos)**

Run: `npx vitest run tests/lib/checkout.test.ts`
Expected: PASS — os 4 testes de `createCheckoutSession` + os 2 novos de `createTransparentSubscription`.

- [ ] **Step 5: Commit**

```bash
git add lib/checkout.ts tests/lib/checkout.test.ts
git commit -m "feat(checkout): createTransparentSubscription (PreApproval via API com card_token)"
```

---

### Task 3: Endpoint de pagamento (`app/api/assinar/pagamento/route.ts`)

Verifica o token → carrega o tenant → confere que ainda está `incomplete` → cria a assinatura → ativa no `authorized`. Inclui o limiter `checkoutPayment` e o `getCouponById` (fetch cru por id, **sem** revalidar uso/expiração — o uso já foi reservado no `/assinar`; revalidar rejeitaria erroneamente um cupom de uso único já consumido).

**Files:**
- Create: `app/api/assinar/pagamento/route.ts`
- Modify: `lib/ratelimit.ts` (adiciona limiter `checkoutPayment`)
- Modify: `lib/db/coupons.ts` (adiciona `getCouponById`)
- Test: `tests/api/assinar-pagamento.test.ts`

**Interfaces:**
- Consumes: `verifyPaymentToken` (Task 1), `createTransparentSubscription` (Task 2), `getTenantById`/`setTenantSubscriptionState`/`getCouponById` (`@/lib/db`), `getPlan`/`isPlanSlug` (`@/lib/plans`), `checkRateLimit`/`getClientIp` (`@/lib/ratelimit`).
- Produces: `POST(req)` handler. Respostas: `200 {ok,slug,status:"authorized"|"pending"|"already_active"}`, `401` token inválido, `402` recusado, `404` loja inexistente, `429` rate-limit, `502` erro no MP.

- [ ] **Step 1: Add the `checkoutPayment` limiter**

Em `lib/ratelimit.ts`, dentro de `export const limiters = { ... }`, adicione:

```ts
  /** Tentativas de pagamento no checkout transparente. 8/min por IP. */
  checkoutPayment: makeLimiter(8, "1 m", "rl:checkout"),
```

- [ ] **Step 2: Add `getCouponById`**

Em `lib/db/coupons.ts`, adicione (o `eq` e `coupons` já estão importados):

```ts
/**
 * Busca crua por id — NÃO aplica validade (used_count/expiração). Usado no
 * pagamento, onde o uso já foi reservado no /assinar; só precisamos da linha
 * para recomputar o desconto.
 */
export async function getCouponById(id: number): Promise<CouponRow | null> {
  const [row] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
  return row ?? null;
}
```

- [ ] **Step 3: Write the failing test**

```ts
// tests/api/assinar-pagamento.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getTenantById = vi.fn();
const getCouponById = vi.fn();
const setTenantSubscriptionState = vi.fn();
const createTransparentSubscription = vi.fn();
const verifyPaymentToken = vi.fn();

vi.mock("@/lib/db", () => ({ getTenantById, getCouponById, setTenantSubscriptionState }));
vi.mock("@/lib/checkout", () => ({ createTransparentSubscription }));
vi.mock("@/lib/payment-token", () => ({ verifyPaymentToken }));
vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: vi.fn(async () => ({ ok: true })),
  getClientIp: vi.fn(() => "1.2.3.4"),
}));

function req(body: unknown) {
  return { json: async () => body, headers: new Headers() } as never;
}

describe("POST /api/assinar/pagamento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyPaymentToken.mockReturnValue({ tenantId: 7, planSlug: "basico", couponId: null });
    getTenantById.mockResolvedValue({ id: 7, slug: "loja", subscription_status: "incomplete", custom_domain: null });
    getCouponById.mockResolvedValue(null);
    createTransparentSubscription.mockResolvedValue({ id: "sub_1", status: "authorized", statusDetail: "accredited" });
  });

  it("ativa o tenant quando o pagamento é authorized", async () => {
    const { POST } = await import("@/app/api/assinar/pagamento/route");
    const res = await POST(req({ paymentToken: "t", card_token: "c", payer_email: "a@b.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, slug: "loja", status: "authorized" });
    expect(setTenantSubscriptionState).toHaveBeenCalledWith(7, "authorized", "sub_1");
  });

  it("401 e não ativa quando o token é inválido/expirado", async () => {
    verifyPaymentToken.mockReturnValue(null);
    const { POST } = await import("@/app/api/assinar/pagamento/route");
    const res = await POST(req({ paymentToken: "x", card_token: "c", payer_email: "a@b.com" }));
    expect(res.status).toBe(401);
    expect(setTenantSubscriptionState).not.toHaveBeenCalled();
  });

  it("402 e não ativa quando o pagamento é rejeitado", async () => {
    createTransparentSubscription.mockResolvedValue({ id: "sub_2", status: "rejected", statusDetail: "cc_rejected_bad_filled_security_code" });
    const { POST } = await import("@/app/api/assinar/pagamento/route");
    const res = await POST(req({ paymentToken: "t", card_token: "c", payer_email: "a@b.com" }));
    expect(res.status).toBe(402);
    expect(setTenantSubscriptionState).not.toHaveBeenCalled();
  });

  it("é idempotente: tenant que já saiu de incomplete não recria assinatura", async () => {
    getTenantById.mockResolvedValue({ id: 7, slug: "loja", subscription_status: "active", custom_domain: null });
    const { POST } = await import("@/app/api/assinar/pagamento/route");
    const res = await POST(req({ paymentToken: "t", card_token: "c", payer_email: "a@b.com" }));
    expect(res.status).toBe(200);
    expect(createTransparentSubscription).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run tests/api/assinar-pagamento.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/assinar/pagamento/route'`.

- [ ] **Step 5: Write the implementation**

```ts
// app/api/assinar/pagamento/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getTenantById, getCouponById, setTenantSubscriptionState } from "@/lib/db";
import { getPlan, isPlanSlug } from "@/lib/plans";
import { createTransparentSubscription } from "@/lib/checkout";
import { verifyPaymentToken } from "@/lib/payment-token";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Etapa 2 do cadastro (Checkout Transparente). Recebe o card_token tokenizado
 * no navegador + o token de pagamento assinado do /assinar, cria a assinatura
 * no MP e ativa o tenant. Público — autorizado pelo paymentToken (HMAC), não
 * por sessão. Rate-limited por IP.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit("checkoutPayment", ip);
  if (!rl.ok) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente em instantes." }, { status: 429 });
  }

  let body: { paymentToken?: unknown; card_token?: unknown; payer_email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const paymentToken = typeof body.paymentToken === "string" ? body.paymentToken : "";
  const cardToken = typeof body.card_token === "string" ? body.card_token : "";
  const payerEmail = typeof body.payer_email === "string" ? body.payer_email.trim().toLowerCase() : "";

  const payload = verifyPaymentToken(paymentToken);
  if (!payload) {
    return NextResponse.json({ error: "Sessão de pagamento expirada. Refaça o cadastro." }, { status: 401 });
  }
  if (!cardToken) return NextResponse.json({ error: "Cartão inválido." }, { status: 400 });
  if (!EMAIL_RE.test(payerEmail)) return NextResponse.json({ error: "E-mail do pagador inválido." }, { status: 400 });
  if (!isPlanSlug(payload.planSlug)) return NextResponse.json({ error: "Plano inválido." }, { status: 400 });

  const tenant = await getTenantById(payload.tenantId);
  if (!tenant) return NextResponse.json({ error: "Loja não encontrada." }, { status: 404 });

  // Idempotência: se já saiu de incomplete, a assinatura já foi criada.
  if (tenant.subscription_status !== "incomplete") {
    return NextResponse.json({ ok: true, slug: tenant.slug, status: "already_active" });
  }

  const coupon = payload.couponId ? await getCouponById(payload.couponId) : null;
  const plan = getPlan(payload.planSlug);

  let result;
  try {
    result = await createTransparentSubscription(tenant, plan, coupon, cardToken, payerEmail);
  } catch (err) {
    console.error("[assinar/pagamento] erro no MP:", err);
    return NextResponse.json({ error: "Não foi possível processar o pagamento. Tente novamente." }, { status: 502 });
  }

  if (result.status === "authorized") {
    await setTenantSubscriptionState(tenant.id, "authorized", result.id);
    return NextResponse.json({ ok: true, slug: tenant.slug, status: "authorized" });
  }
  if (result.status === "pending" || result.status === "in_process") {
    // Não ativa ainda — o webhook (external_reference = tenant.id) reconcilia.
    return NextResponse.json({ ok: true, slug: tenant.slug, status: "pending" });
  }
  return NextResponse.json(
    { ok: false, status: result.status, detail: result.statusDetail, error: "Pagamento recusado. Verifique os dados do cartão ou tente outro." },
    { status: 402 },
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/api/assinar-pagamento.test.ts`
Expected: PASS (4 passing).

- [ ] **Step 7: Commit**

```bash
git add app/api/assinar/pagamento/route.ts lib/ratelimit.ts lib/db/coupons.ts tests/api/assinar-pagamento.test.ts
git commit -m "feat(checkout): endpoint /api/assinar/pagamento (cria assinatura transparente e ativa o tenant)"
```

---

### Task 4: `/api/assinar` devolve paymentToken no modo transparente

Adiciona o ramo `CHECKOUT_MODE=transparent`: em vez de `checkoutUrl`, devolve `{ slug, paymentToken, amount }`. Default (`redirect`) permanece intacto.

**Files:**
- Modify: `app/api/assinar/route.ts`
- Test: `tests/api/assinar-mode.test.ts`

**Interfaces:**
- Consumes: `signPaymentToken` (Task 1), `discountedPriceCents` (`@/lib/coupon-pricing`), `getPlan` (`@/lib/plans`).
- Produces (modo transparent): resposta `201 { ok: true, slug, paymentToken, amount }` (amount em centavos). Modo redirect inalterado: `201 { ok: true, slug, checkoutUrl }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/api/assinar-mode.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const createTenant = vi.fn();
const createUser = vi.fn();
const getTenantBySlug = vi.fn();
const getUserByEmail = vi.fn();
const getCouponByCode = vi.fn();
const getPartnerByCode = vi.fn();
const incrementCouponUse = vi.fn();
const incrementPartnerSignup = vi.fn();
const createCheckoutSession = vi.fn();
const signPaymentToken = vi.fn();
const verifyTurnstile = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { transaction: async (fn: (tx: unknown) => unknown) => fn({}) },
  createTenant, createUser, getTenantBySlug, getUserByEmail,
  getCouponByCode, getPartnerByCode, incrementCouponUse, incrementPartnerSignup,
}));
vi.mock("@/lib/checkout", () => ({ createCheckoutSession }));
vi.mock("@/lib/payment-token", () => ({ signPaymentToken }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile }));
vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: vi.fn(async () => ({ ok: true })),
  getClientIp: vi.fn(() => "1.2.3.4"),
}));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn(async () => "hashed") } }));

function req(body: unknown) {
  return { json: async () => body, headers: new Headers() } as never;
}

const VALID = {
  plan: "basico", slug: "minhaloja", dealership_name: "Minha Loja",
  admin_name: "João", admin_email: "joao@loja.com", admin_password: "senha1234",
  partner_code: "", coupon_code: null, turnstile_token: "tok",
};

describe("POST /api/assinar — modo de checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CHECKOUT_MODE;
    verifyTurnstile.mockResolvedValue(true);
    getTenantBySlug.mockResolvedValue(null);
    getUserByEmail.mockResolvedValue(null);
    getPartnerByCode.mockResolvedValue(null);
    createTenant.mockResolvedValue({ id: 42, slug: "minhaloja" });
    createUser.mockResolvedValue({ id: 1 });
    createCheckoutSession.mockResolvedValue("https://mp/checkout");
    signPaymentToken.mockReturnValue("signed.token");
  });

  it("modo redirect (default): devolve checkoutUrl", async () => {
    const { POST } = await import("@/app/api/assinar/route");
    const res = await POST(req(VALID));
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.checkoutUrl).toBe("https://mp/checkout");
    expect(json.paymentToken).toBeUndefined();
    expect(signPaymentToken).not.toHaveBeenCalled();
  });

  it("modo transparent: devolve paymentToken + amount, sem checkoutUrl", async () => {
    process.env.CHECKOUT_MODE = "transparent";
    const { POST } = await import("@/app/api/assinar/route");
    const res = await POST(req(VALID));
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.paymentToken).toBe("signed.token");
    expect(json.amount).toBe(16990);
    expect(json.checkoutUrl).toBeUndefined();
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(signPaymentToken).toHaveBeenCalledWith({ tenantId: 42, planSlug: "basico", couponId: null });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/api/assinar-mode.test.ts`
Expected: FAIL — o modo transparent ainda não existe; o 2º teste falha (recebe `checkoutUrl`, `paymentToken` undefined).

- [ ] **Step 3: Write the implementation**

No `app/api/assinar/route.ts`:

1. Adicione os imports no topo:

```ts
import { signPaymentToken } from "@/lib/payment-token";
import { discountedPriceCents } from "@/lib/coupon-pricing";
```

2. Substitua o bloco final (hoje):

```ts
    const checkoutUrl = await createCheckoutSession(tenant, getPlan(plan), partner, coupon);

    return NextResponse.json({ ok: true, slug: tenant.slug, checkoutUrl }, { status: 201 });
```

por:

```ts
    if (process.env.CHECKOUT_MODE === "transparent") {
      const paymentToken = signPaymentToken({
        tenantId: tenant.id,
        planSlug: plan,
        couponId: coupon?.id ?? null,
      });
      const planObj = getPlan(plan);
      const amount = coupon ? discountedPriceCents(planObj, coupon) : planObj.priceMonthly;
      return NextResponse.json({ ok: true, slug: tenant.slug, paymentToken, amount }, { status: 201 });
    }

    const checkoutUrl = await createCheckoutSession(tenant, getPlan(plan), partner, coupon);
    return NextResponse.json({ ok: true, slug: tenant.slug, checkoutUrl }, { status: 201 });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/api/assinar-mode.test.ts`
Expected: PASS (2 passing).

- [ ] **Step 5: Commit**

```bash
git add app/api/assinar/route.ts tests/api/assinar-mode.test.ts
git commit -m "feat(checkout): /api/assinar devolve paymentToken quando CHECKOUT_MODE=transparent"
```

---

### Task 5: Infra de frontend — dependência, helper e Card Brick

Instala o SDK do MP, cria o helper `isMpCheckoutEnabled()` (testável, espelha `isTurnstileEnabled`) e o componente `CardBrick` que renderiza o Card Payment Brick e devolve o `card_token`.

**Files:**
- Modify: `package.json` (dependência `@mercadopago/sdk-react`)
- Create: `lib/mp-checkout.ts`
- Create: `components/checkout/CardBrick.tsx`
- Test: `tests/lib/mp-checkout.test.ts`

**Interfaces:**
- Produces:
  - `MP_PUBLIC_KEY: string`, `isMpCheckoutEnabled(): boolean` (`@/lib/mp-checkout`)
  - `<CardBrick amountReais={number} payerEmail?={string} onToken={(d:{token:string;payerEmail:string})=>void|Promise<void>} onError?={(e:unknown)=>void} />`

- [ ] **Step 1: Install the dependency**

Run: `npm install @mercadopago/sdk-react`
Expected: adiciona `@mercadopago/sdk-react` em `dependencies` do `package.json`.

- [ ] **Step 2: Write the failing test**

```ts
// tests/lib/mp-checkout.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("mp-checkout", () => {
  beforeEach(() => vi.resetModules());

  it("habilitado quando a public key existe", async () => {
    process.env.NEXT_PUBLIC_MP_PUBLIC_KEY = "TEST-abc";
    const { isMpCheckoutEnabled } = await import("@/lib/mp-checkout");
    expect(isMpCheckoutEnabled()).toBe(true);
  });

  it("desabilitado quando ausente", async () => {
    delete process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    const { isMpCheckoutEnabled } = await import("@/lib/mp-checkout");
    expect(isMpCheckoutEnabled()).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/lib/mp-checkout.test.ts`
Expected: FAIL — `Cannot find module '@/lib/mp-checkout'`.

- [ ] **Step 4: Write `lib/mp-checkout.ts`**

```ts
// lib/mp-checkout.ts
/** Public key do Mercado Pago — inlined em build (NEXT_PUBLIC_). Vazia = checkout transparente indisponível. */
export const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY?.trim() ?? "";

export function isMpCheckoutEnabled(): boolean {
  return Boolean(MP_PUBLIC_KEY);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/lib/mp-checkout.test.ts`
Expected: PASS (2 passing).

- [ ] **Step 6: Write the `CardBrick` component**

```tsx
// components/checkout/CardBrick.tsx
"use client";

import { useEffect } from "react";
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react";
import { MP_PUBLIC_KEY } from "@/lib/mp-checkout";

interface Props {
  amountReais: number;
  payerEmail?: string;
  onToken: (data: { token: string; payerEmail: string }) => Promise<void> | void;
  onError?: (error: unknown) => void;
}

/**
 * Card Payment Brick do Mercado Pago. Tokeniza o cartão no navegador (o PAN
 * nunca chega ao nosso backend) e entrega o card_token via onToken.
 */
export function CardBrick({ amountReais, payerEmail, onToken, onError }: Props) {
  useEffect(() => {
    if (MP_PUBLIC_KEY) initMercadoPago(MP_PUBLIC_KEY, { locale: "pt-BR" });
  }, []);

  if (!MP_PUBLIC_KEY) {
    return <p className="text-body-s text-danger">Pagamento indisponível no momento.</p>;
  }

  return (
    <CardPayment
      initialization={{ amount: amountReais, payer: payerEmail ? { email: payerEmail } : undefined }}
      onSubmit={async (formData: { token: string; payer?: { email?: string } }) => {
        await onToken({ token: formData.token, payerEmail: formData.payer?.email ?? payerEmail ?? "" });
      }}
      onError={(error: unknown) => onError?.(error)}
    />
  );
}
```

> Nota: os tipos do `@mercadopago/sdk-react` para `onSubmit` podem exigir um ajuste fino. Se o `tsc` reclamar da assinatura, alinhe o parâmetro ao tipo exportado pelo pacote (ex.: `ICardPaymentFormData`) em vez de usar o literal acima — sem `any`.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros. (Ajuste os tipos do Brick se necessário, conforme a nota.)

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json lib/mp-checkout.ts components/checkout/CardBrick.tsx tests/lib/mp-checkout.test.ts
git commit -m "feat(checkout): SDK do Mercado Pago, helper de habilitação e componente CardBrick"
```

---

### Task 6: Página de pagamento e ligação com o `SignupForm`

Cria `/assinar/pagamento` (lê o handoff do `sessionStorage`, renderiza o `CardBrick`, chama o endpoint, trata status) e altera o `SignupForm` para, no modo transparente, guardar o handoff e navegar até a página.

**Files:**
- Create: `app/assinar/pagamento/page.tsx`
- Modify: `components/marketing/SignupForm.tsx`

**Interfaces:**
- Consumes: `<CardBrick>` (Task 5), `POST /api/assinar/pagamento` (Task 3), `formatBRL` (`@/lib/money`).
- Contrato de handoff (sessionStorage, chave `"autostand.payment"`): `{ paymentToken: string; amount: number; slug: string; email: string }` (amount em centavos).

- [ ] **Step 1: Write the payment page**

```tsx
// app/assinar/pagamento/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CardBrick } from "@/components/checkout/CardBrick";
import { formatBRL } from "@/lib/money";

interface Handoff {
  paymentToken: string;
  amount: number; // centavos
  slug: string;
  email: string;
}
const KEY = "autostand.payment";

export default function PaymentPage() {
  const router = useRouter();
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) {
      router.replace("/assinar");
      return;
    }
    try {
      setHandoff(JSON.parse(raw) as Handoff);
    } catch {
      router.replace("/assinar");
    }
  }, [router]);

  if (!handoff) return null;

  async function handleToken({ token, payerEmail }: { token: string; payerEmail: string }) {
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch("/api/assinar/pagamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentToken: handoff!.paymentToken,
          card_token: token,
          payer_email: payerEmail || handoff!.email,
        }),
      });
      const data = await res.json();
      if (res.ok && (data.status === "authorized" || data.status === "already_active")) {
        sessionStorage.removeItem(KEY);
        router.push(`/assinar/sucesso?loja=${encodeURIComponent(handoff!.slug)}`);
        return;
      }
      if (res.ok && data.status === "pending") {
        sessionStorage.removeItem(KEY);
        router.push(`/assinar/sucesso?loja=${encodeURIComponent(handoff!.slug)}&pendente=1`);
        return;
      }
      setError(data.error ?? "Pagamento não aprovado. Tente outro cartão.");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="font-display text-h3 text-ink">Pagamento</h1>
      <p className="mt-1 text-body-s text-n600">
        {formatBRL(handoff.amount)}/mês — {handoff.slug}.autostand.com.br
      </p>
      {error && (
        <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-body-s text-danger">{error}</p>
      )}
      <div className="mt-6" aria-busy={processing}>
        <CardBrick
          amountReais={handoff.amount / 100}
          payerEmail={handoff.email}
          onToken={handleToken}
          onError={() => setError("Erro ao validar o cartão. Confira os dados.")}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Wire the `SignupForm`**

Em `components/marketing/SignupForm.tsx`, dentro de `handleSubmit`, logo após `if (!res.ok) { ... }` e **antes** do bloco `if (data.checkoutUrl)`, insira:

```tsx
      if (data.paymentToken) {
        sessionStorage.setItem(
          "autostand.payment",
          JSON.stringify({
            paymentToken: data.paymentToken,
            amount: data.amount,
            slug: data.slug,
            email: adminEmail,
          }),
        );
        router.push("/assinar/pagamento");
        return;
      }
```

(O `router` já existe no componente; o restante — `checkoutUrl` e `/assinar/sucesso` — permanece como fallback.)

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros de tipo; build conclui. (Se o build falhar por falta de `NEXT_PUBLIC_MP_PUBLIC_KEY`, defina-a vazia no ambiente de build — o `CardBrick` já trata ausência.)

- [ ] **Step 4: Commit**

```bash
git add app/assinar/pagamento/page.tsx components/marketing/SignupForm.tsx
git commit -m "feat(checkout): página /assinar/pagamento e handoff do SignupForm para o fluxo transparente"
```

---

### Task 7: Wiring de ambiente/deploy + verificação E2E no sandbox

Sem testes automatizados (infra + validação manual contra o MP). Liga as envs no build/deploy e valida o fluxo ponta-a-ponta no homolog (sandbox).

**Files:**
- Modify: `Dockerfile`
- Modify: `.github/workflows/deploy-homolog.yml`, `.github/workflows/deploy-production.yml`
- Modify: `.env.homolog.local` (e o example correspondente, se houver)

- [ ] **Step 1: Dockerfile — expor a public key no build**

No `Dockerfile`, logo após as linhas do Turnstile (`ARG/ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY`, ~16-17), adicione:

```dockerfile
ARG NEXT_PUBLIC_MP_PUBLIC_KEY=""
ENV NEXT_PUBLIC_MP_PUBLIC_KEY=$NEXT_PUBLIC_MP_PUBLIC_KEY
```

- [ ] **Step 2: Workflows — passar o build-arg e as envs de runtime**

Em `deploy-homolog.yml` **e** `deploy-production.yml`, espelhando o Turnstile:

1. No bloco `env:` do step de build (junto de `NEXT_PUBLIC_TURNSTILE_SITE_KEY`):

```yaml
          NEXT_PUBLIC_MP_PUBLIC_KEY: ${{ secrets.NEXT_PUBLIC_MP_PUBLIC_KEY }}
```

2. No `docker build`, adicione a linha de build-arg (junto do `--build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY=...`):

```bash
            --build-arg NEXT_PUBLIC_MP_PUBLIC_KEY="$NEXT_PUBLIC_MP_PUBLIC_KEY" \
```

3. No bloco de envs de runtime da task ECS (onde estão `MERCADOPAGO_ACCESS_TOKEN=...` etc.), adicione:

```yaml
            NEXT_PUBLIC_MP_PUBLIC_KEY=${{ secrets.NEXT_PUBLIC_MP_PUBLIC_KEY }}
            PAYMENT_TOKEN_SECRET=${{ secrets.PAYMENT_TOKEN_SECRET }}
            CHECKOUT_MODE=${{ vars.CHECKOUT_MODE }}
```

- [ ] **Step 3: Secrets/vars do GitHub Environment**

Adicione, em cada Environment (`homologation`, `production`):
- Secret `NEXT_PUBLIC_MP_PUBLIC_KEY` (public key do MP — TEST no homolog, APP_USR no prod).
- Secret `PAYMENT_TOKEN_SECRET` (aleatório, ex.: `openssl rand -hex 32`).
- Variable `CHECKOUT_MODE` = `transparent` no homolog; **manter `redirect` em produção** até validar.

- [ ] **Step 4: `.env` local (dev/homolog)**

Adicione ao `.env.homolog.local` (e ao `.env.local` de dev):

```
NEXT_PUBLIC_MP_PUBLIC_KEY=TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PAYMENT_TOKEN_SECRET=<openssl rand -hex 32>
CHECKOUT_MODE=transparent
```

- [ ] **Step 5: Full test suite + build (regressão)**

Run: `npm test && npm run build`
Expected: toda a suíte passa; build conclui.

- [ ] **Step 6: Verificação E2E manual (homolog / sandbox)**

1. No painel do MP (conta de teste / sandbox), crie um **usuário de teste comprador** (distinto da conta coletora) e use **cartões de teste** do MP.
2. Garanta `CHECKOUT_MODE=transparent` + `NEXT_PUBLIC_MP_PUBLIC_KEY` (TEST) no homolog; faça deploy.
3. Crie um cupom fixo que derrube o Básico para ~R$1,00 (desconto R$168,90) via `/superadmin/cupons`.
4. Fluxo: `/assinar` (plano Básico + cupom) → é levado a `/assinar/pagamento` → preencher cartão de teste **aprovado** → confirmar.
5. **Asserções:**
   - `authorized` → redireciona para `/assinar/sucesso`; o tenant vira `active` (checar no `/superadmin/tenants` ou no banco); o site do slug sobe.
   - Repetir com um cartão de teste **recusado** → mensagem de erro na página, tenant continua `incomplete`.
   - Conferir no painel do MP que a assinatura foi criada e que o webhook chegou (o tenant permanece `active`).
6. **Não** habilitar `CHECKOUT_MODE=transparent` em produção antes de: (a) confirmar a public key de produção, (b) validar a homologação da integração transparente exigida pelo MP.

- [ ] **Step 7: Commit**

```bash
git add Dockerfile .github/workflows/deploy-homolog.yml .github/workflows/deploy-production.yml .env.homolog.local
git commit -m "chore(checkout): wiring de build/deploy do Checkout Transparente (MP public key, PAYMENT_TOKEN_SECRET, CHECKOUT_MODE)"
```

---

## Notas de verificação do plano (self-review)

- **Cobertura do spec:** token assinado (T1) · `createTransparentSubscription` (T2) · endpoint + ativação + idempotência + rate-limit + `getCouponById` (T3) · `/assinar` transparent com fallback por env (T4) · SDK + `CardBrick` + helper (T5) · página + wiring do form (T6) · env build-time + webhook inalterado + teste manual sandbox (T7). Webhook permanece intocado (fonte da verdade do ciclo de vida). Redirect preservado via `CHECKOUT_MODE`.
- **`server-only`:** omitido de `lib/payment-token.ts` de propósito (vitest `node` sem stub quebraria); segredo lido em tempo de chamada.
- **Consistência de tipos:** `signPaymentToken`/`verifyPaymentToken` (`PaymentTokenPayload`), `createTransparentSubscription` (`TransparentSubscriptionResult`), handoff `{ paymentToken, amount, slug, email }` e `amount` em centavos são usados de forma idêntica entre T1→T4 e T3↔T6.
