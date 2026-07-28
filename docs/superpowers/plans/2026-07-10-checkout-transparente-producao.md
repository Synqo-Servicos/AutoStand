# Checkout Transparente pronto pra produção — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o Checkout Transparente (Card Brick) o caminho padrão de pagamento no lançamento — pagar dentro do AutoStand, com coleta de CPF/CNPJ da loja e robustez de produção (anti-cobrança-dupla + UX de recusa).

**Architecture:** As peças do fluxo transparente já existem e estão mergeadas (`CardBrick`, `lib/payment-token.ts`, `/api/assinar`, `/api/assinar/pagamento`, `createTransparentSubscription`, webhook). Este plano **enriquece e endurece** — não reescreve. A lógica nova de dinheiro (reconciliação por `search` + idempotency key + tradução de recusa) fica dentro de `lib/checkout.ts::createTransparentSubscription`, mantendo as rotas quase intactas. O redirect (`createCheckoutSession`) permanece como fallback de emergência.

**Tech Stack:** Next.js (App Router) · TypeScript · Drizzle ORM (Postgres/RDS) · Mercado Pago SDK `mercadopago@^3.1.0` (`PreApproval`) · Vitest.

**Spec:** `docs/superpowers/specs/2026-07-10-checkout-transparente-producao-design.md`

## Global Constraints

- **Commits:** NUNCA adicionar linhas `Co-Authored-By` (regra global do usuário).
- **Coluna nova:** `document` em `tenants` — dígitos normalizados (sem máscara), `text` nullable. Segue a convenção de `sellers.document`.
- **Allowlist:** `createTenant` filtra por allowlist (`lib/db/tenants.ts`). Qualquer campo novo precisa entrar em `TENANT_WRITABLE_FIELDS`, senão é silenciosamente descartado.
- **Idempotency key (estável):** `sub-${tenant.id}` no `requestOptions` do `preApproval.create`. Sem ela, o SDK gera uma key aleatória por chamada → retry duplica assinatura.
- **`reason` = `"AutoStand {plano}"`** e **`external_reference` = `String(tenant.id)`** — já existem, mantidos (referência ao plano p/ pontuação MP).
- **Preços (centavos):** Básico `16990`, Pro `34990`, Premium `49990`.
- **Fora de escopo (YAGNI):** device fingerprint (o Card Brick já captura e associa ao token), telefone no cadastro, CPF+CNPJ separados, prefill do documento no Brick, Payment Brick.
- **Fonte de verdade da validação:** o servidor (`/api/assinar`) revalida o documento; o form só faz UX.

---

### Task 1: `lib/br-document.ts` — validação e máscara de CPF/CNPJ

Não existe validador de CPF/CNPJ na base hoje. Módulo puro (sem deps), usável no client e no server.

**Files:**
- Create: `lib/br-document.ts`
- Test: `tests/lib/br-document.test.ts`

**Interfaces:**
- Produces:
  - `normalizeDocument(raw: string): string` — só dígitos.
  - `detectDocumentType(digits: string): "cpf" | "cnpj" | null` — 11→cpf, 14→cnpj, senão null.
  - `isValidDocument(raw: string): boolean` — checksum oficial de CPF **e** CNPJ; aceita com/sem máscara; rejeita sequências repetidas.
  - `formatDocument(raw: string): string` — máscara dinâmica (`000.000.000-00` / `00.000.000/0000-00`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/br-document.test.ts
import { describe, it, expect } from "vitest";
import {
  normalizeDocument, detectDocumentType, isValidDocument, formatDocument,
} from "@/lib/br-document";

describe("normalizeDocument", () => {
  it("mantém só dígitos", () => {
    expect(normalizeDocument("529.982.247-25")).toBe("52998224725");
    expect(normalizeDocument("11.222.333/0001-81")).toBe("11222333000181");
    expect(normalizeDocument("")).toBe("");
  });
});

describe("detectDocumentType", () => {
  it("11 dígitos = cpf, 14 = cnpj, resto = null", () => {
    expect(detectDocumentType("52998224725")).toBe("cpf");
    expect(detectDocumentType("11222333000181")).toBe("cnpj");
    expect(detectDocumentType("123")).toBeNull();
  });
});

describe("isValidDocument", () => {
  it("aceita CPF válido (com e sem máscara)", () => {
    expect(isValidDocument("529.982.247-25")).toBe(true);
    expect(isValidDocument("52998224725")).toBe(true);
  });
  it("aceita CNPJ válido (com e sem máscara)", () => {
    expect(isValidDocument("11.222.333/0001-81")).toBe(true);
    expect(isValidDocument("11222333000181")).toBe(true);
  });
  it("rejeita dígitos verificadores errados", () => {
    expect(isValidDocument("52998224724")).toBe(false);
    expect(isValidDocument("11222333000180")).toBe(false);
  });
  it("rejeita sequências repetidas e tamanhos inválidos", () => {
    expect(isValidDocument("11111111111")).toBe(false);
    expect(isValidDocument("00000000000000")).toBe(false);
    expect(isValidDocument("123")).toBe(false);
    expect(isValidDocument("")).toBe(false);
  });
});

describe("formatDocument", () => {
  it("mascara CPF progressivamente", () => {
    expect(formatDocument("529")).toBe("529");
    expect(formatDocument("52998224725")).toBe("529.982.247-25");
  });
  it("mascara CNPJ progressivamente", () => {
    expect(formatDocument("11222333000181")).toBe("11.222.333/0001-81");
  });
  it("trunca em 14 dígitos", () => {
    expect(formatDocument("112223330001812345")).toBe("11.222.333/0001-81");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/br-document.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/br-document"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/br-document.ts
/**
 * Validação e máscara de CPF/CNPJ. Módulo puro (sem deps de server) — pode ser
 * importado no client (form) e no server (rota). Não havia validador na base.
 */

/** Só dígitos. */
export function normalizeDocument(raw: string): string {
  return (raw ?? "").replace(/\D/g, "");
}

export function detectDocumentType(digits: string): "cpf" | "cnpj" | null {
  if (digits.length === 11) return "cpf";
  if (digits.length === 14) return "cnpj";
  return null;
}

function isValidCpf(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10]);
}

function isValidCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const dv = (len: number) => {
    const weights =
      len === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cnpj[i]) * weights[i];
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  return dv(12) === Number(cnpj[12]) && dv(13) === Number(cnpj[13]);
}

/** Valida CPF ou CNPJ (aceita com ou sem máscara). */
export function isValidDocument(raw: string): boolean {
  const digits = normalizeDocument(raw);
  const type = detectDocumentType(digits);
  if (type === "cpf") return isValidCpf(digits);
  if (type === "cnpj") return isValidCnpj(digits);
  return false;
}

/** Máscara dinâmica para input controlado. */
export function formatDocument(raw: string): string {
  const d = normalizeDocument(raw).slice(0, 14);
  if (d.length <= 11) {
    const p = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 11)];
    let out = p[0];
    if (p[1]) out += "." + p[1];
    if (p[2]) out += "." + p[2];
    if (p[3]) out += "-" + p[3];
    return out;
  }
  const p = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8), d.slice(8, 12), d.slice(12, 14)];
  let out = p[0];
  if (p[1]) out += "." + p[1];
  if (p[2]) out += "." + p[2];
  if (p[3]) out += "/" + p[3];
  if (p[4]) out += "-" + p[4];
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/br-document.test.ts`
Expected: PASS (todos os casos).

- [ ] **Step 5: Commit**

```bash
git add lib/br-document.ts tests/lib/br-document.test.ts
git commit -m "feat(checkout): validação e máscara de CPF/CNPJ (lib/br-document)"
```

---

### Task 2: Coluna `document` no schema + allowlist + migração

**Files:**
- Modify: `lib/schema.ts` (tabela `tenants`, ~linha 74)
- Modify: `lib/db/tenants.ts` (`TENANT_WRITABLE_FIELDS`, ~linha 47)
- Create: `drizzle/0003_*.sql` (gerado)

**Interfaces:**
- Produces: `tenants.document` (coluna `text` nullable); `NewTenant`/`TenantRow` passam a ter `document?: string | null`.

- [ ] **Step 1: Adicionar a coluna no schema**

Em `lib/schema.ts`, dentro de `pgTable("tenants", { ... })`, logo após o campo `coupon_id` (linha ~74):

```ts
  /** CPF ou CNPJ da concessionária (só dígitos). Null em tenants legados/provisionados. */
  document: text("document"),
```

- [ ] **Step 2: Liberar o campo na allowlist de criação**

Em `lib/db/tenants.ts`, na constante `TENANT_WRITABLE_FIELDS` (~linha 36-47), adicionar `"document"` ao array (última linha, junto de `"coupon_id"`):

```ts
    "coupon_id",
    "document",
  ] as const;
```

(`TENANT_CREATE_FIELDS` estende `TENANT_WRITABLE_FIELDS`, então `document` fica gravável na criação automaticamente.)

- [ ] **Step 3: Gerar a migração**

Run: `npm run db:generate`
Expected: cria `drizzle/0003_<nome>.sql` contendo `ALTER TABLE "tenants" ADD COLUMN "document" text;`

- [ ] **Step 4: Verificar tipos e conteúdo da migração**

Run: `npx tsc --noEmit && cat drizzle/0003_*.sql`
Expected: `tsc` sem erros; o SQL contém a linha `ADD COLUMN "document" text`.

- [ ] **Step 5: Aplicar a migração no banco local/homolog**

Run: `npm run db:migrate`
Expected: aplica sem erro (idempotente; a coluna passa a existir).

- [ ] **Step 6: Commit**

```bash
git add lib/schema.ts lib/db/tenants.ts drizzle/
git commit -m "feat(checkout): coluna document (CPF/CNPJ) em tenants + migração"
```

---

### Task 3: Campo CPF/CNPJ no formulário de cadastro

Camada de UX. A validação forte é no servidor (Task 4); aqui é máscara + bloqueio de submit inválido. Sem infra de teste de componente no repo → verificação por typecheck/lint + checagem visual.

**Files:**
- Modify: `components/marketing/SignupForm.tsx`

**Interfaces:**
- Consumes: `isValidDocument`, `formatDocument`, `normalizeDocument` de `@/lib/br-document` (Task 1).
- Produces: o POST para `/api/assinar` passa a incluir `document: <dígitos normalizados>`.

- [ ] **Step 1: Importar os helpers**

No topo de `components/marketing/SignupForm.tsx`, junto dos outros imports:

```tsx
import { isValidDocument, formatDocument, normalizeDocument } from "@/lib/br-document";
```

- [ ] **Step 2: Estado + validação viva**

Junto dos outros `useState` (após `const [adminPassword, setAdminPassword] = useState("");`):

```tsx
  const [document, setDocument] = useState("");
```

E, junto de `liveSlugError` (~linha 42):

```tsx
  const liveDocError = document && !isValidDocument(document) ? "CPF ou CNPJ inválido." : null;
```

- [ ] **Step 3: Enviar no body**

No `body: JSON.stringify({ ... })` do `handleSubmit`, adicionar a chave `document` (após `dealership_name`):

```tsx
          dealership_name: dealershipName,
          document: normalizeDocument(document),
```

- [ ] **Step 4: Renderizar o input**

No bloco "Concessionária", logo após o `<div>` do `dealership_name` (antes do `<div>` do `slug`):

```tsx
        <div>
          <label htmlFor="document" className={labelClass}>
            CPF ou CNPJ
          </label>
          <input
            id="document"
            inputMode="numeric"
            className={`mt-1 ${inputClass} ${liveDocError ? "border-danger focus:border-danger focus:ring-danger/30" : ""}`}
            value={document}
            onChange={(e) => setDocument(formatDocument(e.target.value))}
            placeholder="000.000.000-00"
            required
          />
          {liveDocError && <p className="mt-1 text-body-s text-danger">{liveDocError}</p>}
        </div>
```

- [ ] **Step 5: Bloquear submit inválido**

No `<button type="submit">`, estender o `disabled` (hoje `!canSubmit || !!liveSlugError`):

```tsx
        disabled={!canSubmit || !!liveSlugError || !!liveDocError || !document}
```

- [ ] **Step 6: Verificar tipos e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 7: Checagem visual (manual)**

Run: `npm run dev` → abrir `/assinar`. Digitar `529982247` → vê máscara CPF; completar dígito errado → erro "CPF ou CNPJ inválido." e botão desabilitado; digitar CNPJ válido → máscara `00.000.000/0000-00`, botão habilita.

- [ ] **Step 8: Commit**

```bash
git add components/marketing/SignupForm.tsx
git commit -m "feat(checkout): campo CPF/CNPJ com máscara no cadastro"
```

---

### Task 4: `/api/assinar` — validar e persistir o documento

**Files:**
- Modify: `app/api/assinar/route.ts`
- Test: `tests/api/assinar-mode.test.ts`

**Interfaces:**
- Consumes: `isValidDocument`, `normalizeDocument` de `@/lib/br-document`.
- Produces: `createTenant` passa a receber `document` (dígitos) no objeto de criação.

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/api/assinar-mode.test.ts`: (a) adicionar `document` ao `VALID`; (b) novos casos. Substituir a constante `VALID` e acrescentar os `it`:

```ts
const VALID = {
  plan: "basico", slug: "minhaloja", dealership_name: "Minha Loja",
  document: "52998224725",
  admin_name: "João", admin_email: "joao@loja.com", admin_password: "senha1234",
  partner_code: "", coupon_code: null, turnstile_token: "tok",
};
```

Novos testes dentro do `describe`:

```ts
  it("400 quando o documento é inválido", async () => {
    const { POST } = await import("@/app/api/assinar/route");
    const res = await POST(req({ ...VALID, document: "11111111111" }));
    expect(res.status).toBe(400);
    expect(createTenant).not.toHaveBeenCalled();
  });

  it("persiste o documento normalizado no tenant", async () => {
    const { POST } = await import("@/app/api/assinar/route");
    const res = await POST(req({ ...VALID, document: "529.982.247-25" }));
    expect(res.status).toBe(201);
    expect(createTenant).toHaveBeenCalledWith(
      expect.objectContaining({ document: "52998224725" }),
      expect.anything(),
    );
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/api/assinar-mode.test.ts`
Expected: FAIL — os dois casos novos falham (documento aceito sem validação / não repassado).

- [ ] **Step 3: Implementar a validação + persistência**

Em `app/api/assinar/route.ts`:

Import (junto dos outros):
```ts
import { isValidDocument, normalizeDocument } from "@/lib/br-document";
```

Após `const adminPassword = String(body.admin_password ?? "");` adicionar:
```ts
    const document = normalizeDocument(String(body.document ?? ""));
```

Junto das validações (após `if (!dealershipName) return bad(...)`):
```ts
    if (!isValidDocument(document)) return bad("CPF ou CNPJ inválido.");
```

No `createTenant({ ... }, tx)`, adicionar a chave `document` (após `name: dealershipName,`):
```ts
          name: dealershipName,
          document,
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/api/assinar-mode.test.ts`
Expected: PASS (incluindo os dois modos já existentes — o `VALID` agora tem documento válido).

- [ ] **Step 5: Commit**

```bash
git add app/api/assinar/route.ts tests/api/assinar-mode.test.ts
git commit -m "feat(checkout): /api/assinar valida e persiste CPF/CNPJ"
```

---

### Task 5: `lib/checkout.ts` — reconciliação por `search` + idempotency key

Fecha a cobrança dupla em timeout ambíguo: (1) `search` por `external_reference` antes de criar → reaproveita assinatura já criada; (2) idempotency key estável → o MP deduplica retries.

**Files:**
- Modify: `lib/checkout.ts` (`createTransparentSubscription` + interface)
- Test: `tests/lib/checkout.test.ts`

**Interfaces:**
- Consumes: `PreApproval` do SDK — `search({ options: { external_reference } })` e `create({ body, requestOptions: { idempotencyKey } })`.
- Produces: `createTransparentSubscription` passa a chamar `search` antes de `create`; `create` recebe `requestOptions.idempotencyKey === "sub-" + tenant.id`. `TransparentSubscriptionResult.id` continua `string` nesta task.

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/lib/checkout.test.ts`, adicionar `search` ao mock e novos casos.

No mock (topo do arquivo), adicionar a fn e incluí-la no factory:
```ts
const mockPreApprovalCreate = vi.fn();
const mockPreApprovalSearch = vi.fn();

vi.mock("mercadopago", () => {
  const MercadoPagoConfig = vi.fn();
  function PreApproval() {
    return { create: mockPreApprovalCreate, search: mockPreApprovalSearch, update: vi.fn() };
  }
  function PreApprovalPlan() {
    return { create: mockPlanCreate };
  }
  return { default: MercadoPagoConfig, MercadoPagoConfig, PreApproval, PreApprovalPlan };
});
```

No `beforeEach` do `describe("createTransparentSubscription", ...)`, resetar o search para "nada encontrado":
```ts
    mockPreApprovalCreate.mockReset();
    mockPreApprovalSearch.mockReset();
    mockPreApprovalSearch.mockResolvedValue({ results: [] });
    mockPreApprovalCreate.mockResolvedValue({ id: "sub_123", status: "authorized", status_detail: "accredited" });
    process.env.MERCADOPAGO_ACCESS_TOKEN = "test-token";
```

Novos `it` dentro do mesmo describe:
```ts
  it("envia idempotency key estável sub-<tenantId> no create", async () => {
    const { createTransparentSubscription } = await import("@/lib/checkout");
    await createTransparentSubscription(TENANT, PLAN, null, "tok", "c@t.com");
    expect(mockPreApprovalCreate.mock.calls[0][0].requestOptions).toEqual({ idempotencyKey: "sub-1" });
  });

  it("reconcilia: se já existe assinatura authorized, não cria uma segunda", async () => {
    mockPreApprovalSearch.mockResolvedValue({ results: [{ id: "sub_existing", status: "authorized" }] });
    const { createTransparentSubscription } = await import("@/lib/checkout");
    const res = await createTransparentSubscription(TENANT, PLAN, null, "tok", "c@t.com");
    expect(mockPreApprovalCreate).not.toHaveBeenCalled();
    expect(res).toEqual({ id: "sub_existing", status: "authorized", statusDetail: null });
  });

  it("ignora assinatura cancelada no reconcile e cria nova", async () => {
    mockPreApprovalSearch.mockResolvedValue({ results: [{ id: "old", status: "cancelled" }] });
    const { createTransparentSubscription } = await import("@/lib/checkout");
    await createTransparentSubscription(TENANT, PLAN, null, "tok", "c@t.com");
    expect(mockPreApprovalCreate).toHaveBeenCalledOnce();
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/lib/checkout.test.ts`
Expected: FAIL — `mockPreApprovalSearch` nunca chamada / `requestOptions` undefined.

- [ ] **Step 3: Implementar search + idempotency**

Em `lib/checkout.ts`, substituir o corpo de `createTransparentSubscription` (mantendo a assinatura da função e a montagem do body). Adicionar antes dela o helper de reconciliação:

```ts
/**
 * Reconciliação anti-cobrança-dupla: procura uma assinatura já criada para o
 * tenant (external_reference) que esteja utilizável (authorized/pending). Serve
 * pro caso de timeout ambíguo — o MP criou a assinatura mas a resposta se perdeu
 * e o tenant foi liberado; no retry, reaproveitamos em vez de criar a 2ª.
 */
async function findReconcilableSubscription(
  preApproval: PreApproval,
  tenantId: number,
): Promise<TransparentSubscriptionResult | null> {
  const found = await preApproval.search({ options: { external_reference: String(tenantId) } });
  const usable = found.results?.find((r) => r.status === "authorized" || r.status === "pending");
  if (!usable?.id) return null;
  return { id: String(usable.id), status: String(usable.status), statusDetail: null };
}
```

E o corpo novo de `createTransparentSubscription`:

```ts
export async function createTransparentSubscription(
  tenant: TenantRow,
  plan: Plan,
  coupon: CouponRow | null,
  cardToken: string,
  payerEmail: string,
): Promise<TransparentSubscriptionResult> {
  const preApproval = new PreApproval(getMpClient());

  const existing = await findReconcilableSubscription(preApproval, tenant.id);
  if (existing) return existing;

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
    requestOptions: { idempotencyKey: `sub-${tenant.id}` },
  });

  if (!res.id) throw new Error("MP did not return a preapproval id");
  return {
    id: String(res.id),
    status: String(res.status ?? "pending"),
    statusDetail: (res as { status_detail?: string }).status_detail ?? null,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/lib/checkout.test.ts`
Expected: PASS (os testes antigos de `createTransparentSubscription` continuam verdes — search default `{ results: [] }` → cai no create como antes).

- [ ] **Step 5: Commit**

```bash
git add lib/checkout.ts tests/lib/checkout.test.ts
git commit -m "fix(checkout): reconciliação por external_reference + idempotency key contra cobrança dupla"
```

---

### Task 6: `lib/checkout.ts` — tradução de recusa (throw vs return)

O SDK **lança** o body do erro em 4xx (com `.status` HTTP; retry só ≥500). Numa recusa de cartão isso vira 502 genérico hoje. Passamos a classificar: recusa (4xx) → resultado `rejected` com mensagem pt-BR; transitório (≥500/timeout) → re-throw (rota devolve 502).

**Files:**
- Modify: `lib/checkout.ts` (interface + `createTransparentSubscription` + helpers)
- Test: `tests/lib/checkout.test.ts`

**Interfaces:**
- Produces:
  - `translateDecline(statusDetail: string | null | undefined): string` — código MP → mensagem pt-BR (fallback genérico).
  - `TransparentSubscriptionResult.id` passa a `string | null` (null em recusa lançada); ganha `message?: string` (presente só quando `status === "rejected"`).

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/lib/checkout.test.ts`, novo describe + casos no describe de `createTransparentSubscription`:

```ts
import { translateDecline } from "@/lib/checkout";

describe("translateDecline", () => {
  it("mapeia códigos conhecidos", () => {
    expect(translateDecline("cc_rejected_insufficient_amount")).toMatch(/saldo|limite/i);
    expect(translateDecline("cc_rejected_bad_filled_security_code")).toMatch(/segurança|CVV/i);
  });
  it("cai no genérico para desconhecido/null", () => {
    expect(translateDecline("algo_novo")).toMatch(/recusado/i);
    expect(translateDecline(null)).toMatch(/recusado/i);
  });
});
```

Casos no describe de `createTransparentSubscription`:
```ts
  it("traduz recusa lançada em 4xx (não re-lança)", async () => {
    mockPreApprovalCreate.mockRejectedValue({ status: 400, cause: [{ code: "cc_rejected_insufficient_amount" }] });
    const { createTransparentSubscription } = await import("@/lib/checkout");
    const res = await createTransparentSubscription(TENANT, PLAN, null, "tok", "c@t.com");
    expect(res.status).toBe("rejected");
    expect(res.id).toBeNull();
    expect(res.message).toMatch(/saldo|limite/i);
    expect(res.statusDetail).toBe("cc_rejected_insufficient_amount");
  });

  it("re-lança erro transitório (>=500) para a rota devolver 502", async () => {
    mockPreApprovalCreate.mockRejectedValue({ status: 500, message: "internal" });
    const { createTransparentSubscription } = await import("@/lib/checkout");
    await expect(createTransparentSubscription(TENANT, PLAN, null, "tok", "c@t.com")).rejects.toBeTruthy();
  });

  it("inclui message quando o MP retorna rejected (sem lançar)", async () => {
    mockPreApprovalCreate.mockResolvedValue({ id: "sub_r", status: "rejected", status_detail: "cc_rejected_bad_filled_security_code" });
    const { createTransparentSubscription } = await import("@/lib/checkout");
    const res = await createTransparentSubscription(TENANT, PLAN, null, "tok", "c@t.com");
    expect(res.status).toBe("rejected");
    expect(res.message).toMatch(/segurança|CVV/i);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/lib/checkout.test.ts`
Expected: FAIL — `translateDecline` não existe; o create rejeitado propaga o erro.

- [ ] **Step 3: Implementar a tradução + classificação**

Em `lib/checkout.ts`, atualizar a interface:

```ts
export interface TransparentSubscriptionResult {
  id: string | null;
  status: string;
  statusDetail: string | null;
  /** Mensagem pt-BR de recusa — presente só quando status === "rejected". */
  message?: string;
}
```

Adicionar os helpers (perto do topo do módulo, após `getMpClient`):

```ts
const DECLINE_MESSAGES: Record<string, string> = {
  cc_rejected_insufficient_amount: "Cartão sem saldo ou limite disponível. Tente outro cartão.",
  cc_rejected_bad_filled_security_code: "Código de segurança (CVV) inválido.",
  cc_rejected_bad_filled_date: "Data de validade inválida.",
  cc_rejected_bad_filled_card_number: "Número do cartão inválido.",
  cc_rejected_bad_filled_other: "Confira os dados do cartão e tente novamente.",
  cc_rejected_call_for_authorize: "Autorize a compra com o seu banco e tente de novo.",
  cc_rejected_card_disabled: "Cartão desabilitado. Ative-o com o banco ou use outro.",
  cc_rejected_high_risk: "Pagamento não autorizado. Tente outro cartão.",
  cc_rejected_max_attempts: "Muitas tentativas com este cartão. Tente mais tarde ou use outro.",
  cc_rejected_duplicated_payment: "Pagamento duplicado. Aguarde alguns minutos antes de tentar de novo.",
};
const GENERIC_DECLINE = "Cartão recusado. Verifique os dados ou tente outro cartão.";

export function translateDecline(statusDetail: string | null | undefined): string {
  return (statusDetail && DECLINE_MESSAGES[statusDetail]) || GENERIC_DECLINE;
}

/** Body de erro lançado pelo SDK do MP (parcial, defensivo). */
interface MpErrorShape {
  status?: number;
  message?: string;
  cause?: Array<{ code?: string | number; description?: string }>;
}

function extractStatusDetail(err: MpErrorShape): string | null {
  const code = err?.cause?.[0]?.code;
  return code != null ? String(code) : null;
}

/** 4xx = recusa/cliente (não retry). >=500 ou sem status = transitório. */
function isDeclineError(err: MpErrorShape): boolean {
  return typeof err?.status === "number" && err.status >= 400 && err.status < 500;
}
```

Atualizar o bloco `create` de `createTransparentSubscription` (o que a Task 5 introduziu) para try/catch + message:

```ts
  let res;
  try {
    res = await preApproval.create({
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
      requestOptions: { idempotencyKey: `sub-${tenant.id}` },
    });
  } catch (err) {
    const e = err as MpErrorShape;
    if (isDeclineError(e)) {
      const statusDetail = extractStatusDetail(e);
      return { id: null, status: "rejected", statusDetail, message: translateDecline(statusDetail) };
    }
    throw err; // transitório → a rota devolve 502
  }

  if (!res.id) throw new Error("MP did not return a preapproval id");
  const statusDetail = (res as { status_detail?: string }).status_detail ?? null;
  const status = String(res.status ?? "pending");
  const result: TransparentSubscriptionResult = { id: String(res.id), status, statusDetail };
  if (status === "rejected") result.message = translateDecline(statusDetail);
  return result;
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/lib/checkout.test.ts`
Expected: PASS. O teste antigo do caminho `authorized` (`toEqual({ id, status, statusDetail })`) continua verde — sem `message` no sucesso.

- [ ] **Step 5: Commit**

```bash
git add lib/checkout.ts tests/lib/checkout.test.ts
git commit -m "feat(checkout): traduz recusa do MP (throw 4xx vs transitório) em mensagem pt-BR"
```

---

### Task 7: `/api/assinar/pagamento` — usar a mensagem de recusa no 402

**Files:**
- Modify: `app/api/assinar/pagamento/route.ts` (bloco 402, ~linha 86-90)
- Test: `tests/api/assinar-pagamento.test.ts`

**Interfaces:**
- Consumes: `TransparentSubscriptionResult.message` (Task 6).

- [ ] **Step 1: Escrever o teste que falha**

Em `tests/api/assinar-pagamento.test.ts`, novo caso:

```ts
  it("402 usa a mensagem específica de recusa vinda do checkout", async () => {
    createTransparentSubscription.mockResolvedValue({
      id: null, status: "rejected",
      statusDetail: "cc_rejected_insufficient_amount",
      message: "Cartão sem saldo ou limite disponível. Tente outro cartão.",
    });
    const { POST } = await import("@/app/api/assinar/pagamento/route");
    const res = await POST(req({ paymentToken: "t", card_token: "c", payer_email: "a@b.com" }));
    expect(res.status).toBe(402);
    expect((await res.json()).error).toBe("Cartão sem saldo ou limite disponível. Tente outro cartão.");
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/api/assinar-pagamento.test.ts`
Expected: FAIL — `error` ainda é a string genérica fixa.

- [ ] **Step 3: Implementar**

Em `app/api/assinar/pagamento/route.ts`, no bloco final (recusa), trocar a linha do `error` para preferir `result.message`:

```ts
  await releaseTenantCheckout(tenant.id);
  return NextResponse.json(
    {
      ok: false,
      status: result.status,
      detail: result.statusDetail,
      error: result.message ?? "Pagamento recusado. Verifique os dados do cartão ou tente outro.",
    },
    { status: 402 },
  );
```

- [ ] **Step 4: Rodar e ver passar (suite inteira do endpoint)**

Run: `npx vitest run tests/api/assinar-pagamento.test.ts`
Expected: PASS (o novo caso + todos os antigos — recusa genérica ainda cai no fallback quando `message` é undefined).

- [ ] **Step 5: Commit**

```bash
git add app/api/assinar/pagamento/route.ts tests/api/assinar-pagamento.test.ts
git commit -m "feat(checkout): 402 mostra a mensagem específica de recusa do MP"
```

---

### Task 8: Ligar o fluxo + validar (sandbox → R$1 real) + painel MP

Sem código. Rollout controlado e validação da UX de recusa que só se prova ao vivo. Fazer em **homolog primeiro**.

**Files:** nenhum (config de ambiente + painel MP + verificação manual).

- [ ] **Step 1: Suite completa verde antes de ligar nada**

Run: `npm test`
Expected: todos os testes passam (br-document, assinar-mode, checkout, assinar-pagamento e o resto).

- [ ] **Step 2: Garantir as envs por ambiente (homolog)**

No GitHub Environment de **homolog**, confirmar/definir:
- `CHECKOUT_MODE=transparent`
- `NEXT_PUBLIC_MP_PUBLIC_KEY` — **presente no build** (é build-time/inlined; ver `checkout-transparente-mp` / `turnstile-build-time-footgun`).
- `PAYMENT_TOKEN_SECRET` — definido.
- `MERCADOPAGO_ACCESS_TOKEN` — já existente.

- [ ] **Step 3: Deploy em homolog e smoke do cadastro**

Deploy homolog (fluxo normal do repo). Abrir `/assinar`, cadastrar com CNPJ válido → deve cair em `/assinar/pagamento` (Card Brick), **sem redirect externo**. Confirmar que o Brick renderiza o campo de documento (CPF/CNPJ) do titular em pt-BR.

- [ ] **Step 4: Validar cada ramo de recusa no sandbox**

Com usuário-comprador de teste + cartões de teste do MP, usar o **nome do titular** para forçar o desfecho e conferir a mensagem exibida na tela:
- `APRO` → aprovado → `/assinar/sucesso`, tenant vira `active`.
- `FUND` → "sem saldo/limite".
- `SECU` → "código de segurança (CVV) inválido".
- `EXPI` → validade.
- `OTHE` → genérico "cartão recusado".
- `CALL` → "autorize com o banco".

Ajustar o mapa `DECLINE_MESSAGES`/`extractStatusDetail` (Task 6) **se a forma real do erro do MP divergir** do previsto (é o objetivo de validar ao vivo). Se ajustar, reabrir Task 6 (teste + código + commit).

- [ ] **Step 5: Teste com valor real (R$1)**

Cupom fixo derrubando o Básico p/ ~R$1, uma assinatura real de ponta a ponta → confirmar tenant `active` (e webhook) → cancelar/limpar (o `/superadmin` já tem cancelar+apagar tenant de teste). Confirmar que **não** houve cobrança dupla ao repetir/atualizar durante o processamento.

- [ ] **Step 6: Painel do Mercado Pago (Synqo → AutoStand)**

No painel da conta MP de produção:
- **Nome fantasia** da conta → "AutoStand".
- **Soft descriptor** da fatura do cartão → "AUTOSTAND" (o que aparece no extrato do cliente).

- [ ] **Step 7: Ligar em produção**

Só após homolog validado: definir `CHECKOUT_MODE=transparent` no GitHub Environment de **prod** e confirmar `NEXT_PUBLIC_MP_PUBLIC_KEY`/`PAYMENT_TOKEN_SECRET` no build de prod. Deploy prod (manual/workflow_dispatch, conforme o fluxo do repo). Smoke final com um cadastro real.

- [ ] **Step 8: Commit da doc de rollout (opcional)**

Se quiser registrar o checklist do painel MP no repo:
```bash
git add docs/
git commit -m "docs(checkout): checklist de rollout do Checkout Transparente"
```

---

## Notas de verificação (self-review)

- **Cobertura da spec:** identidade CPF/CNPJ (Tasks 1-4), pontuação via reason/external_reference/token já existentes + device fora de escopo (Global Constraints), anti-double-charge (Task 5), UX de recusa (Tasks 6-7), ligar o fluxo + validação + painel MP (Task 8). ✔
- **Boundary:** toda a lógica de dinheiro nova mora em `lib/checkout.ts`; as rotas quase não mudam (só a mensagem no 402). As rotas seguem mockando `createTransparentSubscription`, como já faziam.
- **Consistência de tipos:** `TransparentSubscriptionResult` evolui `id: string → string | null` e ganha `message?` na Task 6; a Task 7 consome `result.message`; caminho `authorized` nunca inclui `message` (mantém o `toEqual` antigo verde).
- **Ordem de dependência:** 1 → 2 → (3, 4) → 5 → 6 → 7 → 8. Tasks 3 e 4 dependem de 1; 4 também de 2. 7 depende de 6.
