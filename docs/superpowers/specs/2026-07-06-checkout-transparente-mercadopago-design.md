---
title: Checkout Transparente Mercado Pago — Design
tags:
  - spec
  - pagamento
  - mercadopago
data: 2026-07-06
status: aprovado (design)
---

# Checkout Transparente do Mercado Pago — Design

## Problema

No fluxo de assinatura atual (`lib/checkout.ts`), o AutoStand cria uma assinatura
(`PreApproval` via `preapproval_plan_id`) e **redireciona** o lojista para
`mercadopago.com.br/subscriptions/checkout`. O modelo de assinatura hospedada do MP
**exige que o pagador tenha e faça login numa conta Mercado Pago/Mercado Livre** — é
a conta que fica amarrada para a cobrança recorrente. Isso tira o lojista do ambiente
do AutoStand e adiciona fricção (criar/entrar numa conta ML só para pagar).

**Objetivo:** o lojista paga digitando os dados do cartão **na própria tela do
AutoStand**, sem precisar de conta Mercado Pago/Livre — via **Checkout Transparente**
(SDK JS + Card Payment Brick tokeniza o cartão no navegador; o backend cria o
`PreApproval` com o `card_token`).

## Escopo e prioridade

- **Fast-follow, não bloqueador de lançamento.** O redirect atual **funciona** e será
  usado para validar o pagamento e lançar (julho/2026). O Checkout Transparente entra
  logo depois e se torna o fluxo principal.
- O redirect (`createCheckoutSession`) **permanece no código** como fallback durante a
  transição, controlado por env — sem UI dupla exposta ao lojista.
- **Formato escolhido:** duas etapas (cadastro → página de pagamento in-app).

## Fluxo (caminho feliz)

1. `SignupForm` → `POST /api/assinar` cria tenant `incomplete` + usuário admin +
   reserva o cupom (**comportamento atual preservado**), mas em vez de `checkoutUrl`
   retorna `{ slug, paymentToken, amount }`.
2. `paymentToken` = token curto **assinado (HMAC)** contendo
   `tenantId + planSlug + couponId + exp (~30 min)`. Autoriza a etapa seguinte a agir
   sobre *aquele* tenant (o lojista ainda não tem sessão).
3. O front navega para `/assinar/pagamento`, que carrega o **MP JS SDK**
   (`NEXT_PUBLIC_MP_PUBLIC_KEY`) e renderiza o **Card Payment Brick**. O cartão é
   tokenizado **no navegador** → gera `card_token`.
4. `POST /api/assinar/pagamento` com `{ paymentToken, card_token, payer_email }` →
   backend verifica o token, confere que o tenant continua `incomplete`, e chama
   `createTransparentSubscription()`.
5. O MP cria o `PreApproval` (`card_token_id` + `payer_email` + `auto_recurring` com o
   valor do cupom + `external_reference = tenantId` + `status: authorized`) e retorna o
   status **na hora**.
6. `authorized` → ativa o tenant sincronamente
   (`setTenantSubscriptionState(id, "authorized", preapprovalId)`) → redireciona para
   `/assinar/sucesso`. `pending`/`rejected` → tratado na própria página (ver Erros).

## Componentes (unidades isoladas)

| Unidade | Papel | Estado |
|---|---|---|
| `lib/checkout.ts::createTransparentSubscription()` | Cria `PreApproval` via API com `card_token`. Reusa `discountedPriceCents`. Trata `free_month` (trial) como no fluxo atual. | **novo** (ao lado do `createCheckoutSession` existente) |
| `lib/payment-token.ts` | Assina/verifica o token curto de autorização. Função pura, testável. | **novo** |
| `app/api/assinar/route.ts` | Passa a devolver `paymentToken` no lugar de `checkoutUrl`. Flag de env (`CHECKOUT_MODE=transparent\|redirect`) permite cair no redirect. | modificado |
| `app/api/assinar/pagamento/route.ts` | Verifica token → cria assinatura → ativa tenant. Rate-limited. | **novo** |
| `app/assinar/pagamento/page.tsx` + `CardBrick` (client) | Renderiza o Brick, tokeniza, chama a API, trata estados. | **novo** |
| `app/api/webhooks/mercadopago/route.ts` | **Inalterado** — segue como fonte da verdade do ciclo de vida (`paused`/`cancelled`/`past_due`). A ativação síncrona é apenas otimização. | inalterado |

### Corpo do `PreApproval` (transparente)

```ts
const priceCents = coupon ? discountedPriceCents(plan, coupon) : plan.priceMonthly;
const amount = Math.max(1, priceCents) / 100; // piso de código; MP tem mínimo próprio

const body = {
  reason,                                  // mesma lógica de rótulo do fluxo atual
  external_reference: String(tenant.id),
  payer_email,
  card_token_id: card_token,
  auto_recurring: {
    frequency: 1,
    frequency_type: "months",
    transaction_amount: amount,
    currency_id: "BRL",
    ...(coupon?.discount_type === "free_month"
      ? { free_trial: { frequency: 1, frequency_type: "months" } }
      : {}),
  },
  back_url: `${tenantSiteUrl(tenant)}/admin/assinatura`,
  status: "authorized",
};
```

## Segurança / autorização

- **PCI SAQ-A:** o cartão só existe no navegador (Brick tokeniza contra o MP). O backend
  recebe só o `card_token` — **nunca o PAN**. Proibido logar/persistir número de cartão.
- **Token de pagamento assinado:** sem ele, qualquer um poderia `POST
  /api/assinar/pagamento` com um `tenantId` alheio e amarrar um cartão a outro tenant.
  O HMAC (com **segredo dedicado**, não o `AUTH_SECRET`) prende
  `tenantId + planSlug + couponId + exp`. O endpoint **rejeita** quando: token
  inválido/expirado, tenant inexistente, ou tenant **não está mais `incomplete`**
  (idempotência — evita assinatura dupla).
- **Rate-limit** no endpoint de pagamento reusando `lib/ratelimit.ts` (por IP).
- **`payer_email`** não pode ser igual ao e-mail da conta coletora (o MP recusa). No
  teste, exige um e-mail de comprador distinto.

## Tratamento de erros (`/assinar/pagamento`)

| Situação | Comportamento |
|---|---|
| Cartão recusado (`rejected`) | Mostra o `status_detail` do MP em PT-BR; permite novo cartão (o Brick regera o token). |
| Desafio 3D Secure | O Card Brick resolve o challenge inline → pode voltar `pending` → webhook confirma. |
| `pending` | Tela "processando"; ativa quando o webhook chega. |
| Token expirado (30 min) | A conta já existe como `incomplete` → lojista **loga e paga pelo `/admin/assinatura`** (mesma Brick reaproveitada). |
| Erro MP/rede | Retry genérico. |

> **Fallback natural:** como o tenant é criado antes do pagamento, uma falha nunca
> perde a conta. O `/admin/assinatura` (já é o `back_url`) hospeda a mesma Brick para
> pagar/reativar depois — unifica "1º pagamento" e "retry/reativação".
>
> **Sem regressão de cupom:** o cupom já é reservado no `/assinar` hoje (antes do
> pagamento por redirect). Pagamentos abandonados "queimam" um uso — comportamento
> idêntico ao atual. Mitigar com margem em `max_uses`.

## Ambiente / dependências

- **`@mercadopago/sdk-react`** — nova dependência de frontend (Card Payment Brick).
- **`NEXT_PUBLIC_MP_PUBLIC_KEY`** — ⚠️ **pegadinha conhecida do projeto:** vars
  `NEXT_PUBLIC_` são *build-time* no build standalone do Next (mesmo caso do Turnstile).
  Precisa estar presente **no build do Docker**, não só em runtime, senão a Brick não
  inicializa. Registrar como passo explícito no CI/deploy.
- **`MERCADOPAGO_ACCESS_TOKEN`** já existe (server-side) — precisa ser de **produção**
  para cobrança real.
- **`PAYMENT_TOKEN_SECRET`** (novo) — segredo dedicado para o HMAC do token de pagamento.

## Testes

- **Unit:** `discountedPriceCents` (já existe) + `createTransparentSubscription`
  (montagem do body/valor, ramo `free_month`) + `payment-token` (assinatura,
  adulteração, expiração).
- **Sandbox:** usuários de teste do MP (coletor + comprador) e cartões de teste →
  cobrir `authorized` / `rejected` / `pending`.
- **E2E:** signup → página de pagamento → MP mockado → tenant `active`.
- **Manual:** o teste do cupom de valor baixíssimo (fixo derrubando para ~R$1,00 no
  plano Básico), agora pelo fluxo transparente.

## Riscos

- **Homologação da integração transparente:** o MP pode exigir critérios de qualidade
  para produção (device fingerprint — a Brick já injeta o `device_id`). Não bloqueia o
  desenho; validar antes de habilitar em prod.
- **Mínimo de valor do MP:** o piso de código é R$0,01, mas o MP tem mínimo próprio.
  Para testes de valor baixo, usar faixa segura (R$1,00–R$5,00).

## Fora de escopo (YAGNI por ora)

- Expor transparente + redirect lado a lado como opção de UI (Caminho C).
- Card Brick embutido na mesma tela do cadastro (Caminho B).
- Troca de cartão / gestão de meio de pagamento além do 1º pagamento e retry.

## Referências

- [[Plano de Lançamento]] — P0 "Validar pagamento ao vivo".
- `lib/checkout.ts`, `app/api/assinar/route.ts`, `components/marketing/SignupForm.tsx`,
  `app/api/webhooks/mercadopago/route.ts`, `lib/db/tenants.ts` (`MP_STATUS_MAP`).
