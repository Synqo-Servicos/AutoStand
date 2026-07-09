# Diagnósticos de pagamento no superadmin — Design

**Data:** 2026-07-08
**Status:** aprovado (aguardando revisão do spec)
**Contexto relacionado:** [checkout-transparente], runbook de validação live (cupom R$1), `autostand-launch-readiness` (P0 = payment validation).

## Objetivo

Dar ao superadmin duas ferramentas de diagnóstico para validar o processamento de pagamentos **em produção**, sem depender de terceiros nem de scripts locais:

1. **PIX rápido** — provar que o `MERCADOPAGO_ACCESS_TOKEN` de prod é válido e a conta MP recebe dinheiro. Não toca em tenant, assinatura nem webhook.
2. **Fluxo completo** — provar o pipeline de billing ponta a ponta: checkout (redirect) → pagamento com cartão real → webhook `preapproval` → tenant vira `active`.

Motivação: o access token de prod vive server-side (GH secret / task def do ECS) e não está disponível localmente; rodar o teste de dentro do app resolve isso naturalmente e ainda deixa uma ferramenta reutilizável.

## Escopo

**Dentro:**
- Uma página `app/superadmin/(panel)/diagnostico/page.tsx` hospedando as duas ferramentas + entrada no menu do superadmin.
- Rotas `app/api/superadmin/pix-teste/route.ts` e `app/api/superadmin/fluxo-teste/route.ts`, ambas gated por `withSuperAdmin`.
- Testes unitários das rotas com o SDK do MP e as funções de DB mockadas.

**Fora (explícito):**
- **Webhook não muda** — a ferramenta 2 usa o handler de `preapproval` existente (`app/api/webhooks/mercadopago/route.ts`). PIX (`type: "payment"`) continua ignorado pelo webhook; por isso a ferramenta 1 valida status por **polling direto na API**, não por webhook.
- **Checkout Transparente continua OFF** — nenhuma das ferramentas liga `CHECKOUT_MODE=transparent` nem usa `createTransparentSubscription`. O fluxo completo usa o **redirect** (`createCheckoutSession`), que é o caminho live.
- Sem rate-limit dedicado — o gating `super_admin` é suficiente; cada disparo gera um pagamento real de valor mínimo.

## Arquitetura e reuso

Nenhuma peça de infra nova. Reusa:

- Auth: `withSuperAdmin`, `ApiError` de `@/lib/api` (padrão das rotas superadmin existentes).
- Tenants: `createTenant`, `getTenantById`, `deleteTenant` de `lib/db/tenants.ts` (`deleteTenant` já limpa blobs).
- Checkout/assinatura: `createCheckoutSession`, `cancelMpSubscription` de `lib/checkout.ts`; `discountedPriceCents` de `lib/coupon-pricing.ts`; `getPlan`/`PLANS.basico` (16990 = R$169,90) de `lib/plans.ts`.
- SDK: `mercadopago` v3.1.0 — recursos `Payment` (PIX one-off) e `PreApproval` (via checkout existente). Client: `new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! })` (mesmo padrão de `lib/checkout.ts`).

## Ferramenta 1 — PIX rápido

### Rota `app/api/superadmin/pix-teste/route.ts`

- **`POST`** → cria um `Payment` PIX:
  ```
  transaction_amount: 0.01,
  payment_method_id: "pix",
  description: "AutoStand — diagnóstico de pagamento",
  payer: { email: "diagnostico@autostand.com.br" }
  ```
  Extrai de `point_of_interaction.transaction_data` e devolve:
  `{ id, status, amount, qrCode, qrCodeBase64, ticketUrl }`.
- **`GET ?id=<paymentId>`** → `payment.get({ id })` → `{ id, status, statusDetail }`.
  Status transita `pending → approved` quando o PIX é pago.

### UI (seção 1 da página)

- Botão **"Gerar PIX de teste (R$0,01)"** → `POST` → exibe: QR (`<img>` do `qrCodeBase64`), copia-e-cola (`qrCode`) com botão copiar, e o payment id.
- Botão **"Atualizar status"** → `GET ?id=` → badge de status.
- Sem auto-poll; refresh manual (YAGNI).
- Sem reembolso automático — R$0,01 é negligível. (Se necessário no futuro, adicionar botão de refund via `PaymentRefund`.)

## Ferramenta 2 — Fluxo completo de assinatura (R$1, redirect)

### Rota `app/api/superadmin/fluxo-teste/route.ts`

- **`POST`** (iniciar):
  1. `createTenant` com campos mínimos: `name: "Diagnóstico"`, `slug: "diag-<id-curto>"`, `plan: "basico"`, **sem criar usuário**.
  2. Monta um **cupom sintético em memória** (não persistido): `{ discount_type: "fixed", discount_value: 16890, ... }` → `discountedPriceCents(básico, cupom)` = 100 centavos = **R$1,00**.
  3. `createCheckoutSession(tenant, getPlan("basico"), null, cupomSintético)` → cria um `PreApprovalPlan` dedicado (mesmo caminho do cliente real) e devolve a URL de checkout.
  4. Devolve `{ tenantId, slug, checkoutUrl }`.
- **`GET ?tenantId=<id>`** (status): `getTenantById` → `{ subscription_status, mp_subscription_id }`.
- **`DELETE ?tenantId=<id>`** (limpar):
  1. Se `mp_subscription_id` presente → `cancelMpSubscription(mp_subscription_id)`.
  2. `deleteTenant(tenantId)`.

### UI (seção 2 da página)

1. Botão **"Iniciar teste (R$1)"** → `POST` → mostra link **"Abrir checkout do MP"** (`checkoutUrl`) + slug criado.
2. O superadmin paga R$1 com cartão real na tela do MP. O redirect pós-pagamento aponta para o painel do tenant `diag-` (que não tem usuário) — **pode ser ignorado**; o que importa é o webhook `preapproval` chegar.
3. Botão **"Atualizar status"** → `GET` → badge `incomplete → active` (mapeamento `authorized → active` em `MP_STATUS_MAP`).
4. Botão **"Limpar (cancelar + apagar tenant)"** → `DELETE`. **Obrigatório** para não deixar assinatura recorrente viva.

## Fluxo de dados (ferramenta 2)

```
superadmin → POST /fluxo-teste
  → createTenant(diag-xxx) + createCheckoutSession(R$1) → checkoutUrl
superadmin abre checkoutUrl → paga R$1 (cartão real) no MP
MP → POST /api/webhooks/mercadopago (preapproval authorized)
  → setTenantSubscriptionState(tenantId, "authorized") → subscription_status = "active"
superadmin → GET /fluxo-teste?tenantId → "active" ✅
superadmin → DELETE /fluxo-teste?tenantId → cancelMpSubscription + deleteTenant
```

## Erros e segurança

- Ambas as rotas: `withSuperAdmin` (401 se não for `super_admin`).
- `MERCADOPAGO_ACCESS_TOKEN` ausente → responder **503** com mensagem clara (não 500 genérico).
- Token inválido / erro do MP → repassar a mensagem do MP via `ApiError` — esse erro **é o sinal** de credencial inválida que o diagnóstico existe para detectar.
- Tenants de diagnóstico são identificáveis pelo prefixo de slug `diag-` e removidos pela limpeza.

## Testes

Unit das três rotas (vitest, padrão `tests/api/`), com o SDK do MP e as funções de DB mockadas:
- `pix-teste POST` → cria pagamento, devolve `qrCode`/`qrCodeBase64`/`id`.
- `pix-teste GET` → devolve status.
- `fluxo-teste POST` → cria tenant + chama `createCheckoutSession` com amount R$1 (asserta o cupom sintético).
- `fluxo-teste DELETE` → chama `cancelMpSubscription` (quando há `mp_subscription_id`) e `deleteTenant`.
- Ausência de token → 503.

## Notas operacionais

- A ferramenta 2 cria **assinatura recorrente real** — cancelar via "Limpar" é obrigatório, senão cobra mensalmente.
- Se o MP recusar R$1,00 por mínimo próprio, subir o cupom sintético para R$5,00 (`discount_value = 16490`).
- Nenhuma das ferramentas altera o comportamento visível para lojistas ou compradores.
