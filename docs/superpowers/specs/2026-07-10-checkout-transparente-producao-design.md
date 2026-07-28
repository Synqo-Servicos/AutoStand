# Checkout Transparente pronto pra produção — Design

**Data:** 2026-07-10
**Status:** Aprovado (brainstorming)
**Contexto:** [[checkout-transparente-mp]], [[autostand-launch-readiness]], [[turnstile-build-time-footgun]]

## Problema

O cadastro de concessionária hoje **redireciona** para o Checkout Pro hospedado do
Mercado Pago (`CHECKOUT_MODE` não setado → `createCheckoutSession`). Isso gera três
dores confirmadas em teste:

1. **Sai da plataforma** — o cliente cai numa página externa do MP.
2. **"Compra insegura"** — o susto de uma página desconhecida, com o nome **"Synqo"**
   (razão social da conta MP) em vez de "AutoStand".
3. **Baixa confiança** na jornada de pagamento, logo no primeiro contato pago.

O fluxo de **Checkout Transparente** (pagar dentro do AutoStand, via Card Payment
Brick) **já está implementado e mergeado**, mas desligado por default e sem o
hardening que a nota de memória exige antes de lidar com dinheiro real.

A conta MP de produção **já está verificada** (CNPJ validado, dados completos),
registrada legalmente como Synqo. Portanto "insegura" **não** é reputação de conta —
some em boa parte simplesmente por não redirecionar. O nome exibido "AutoStand" é
configuração de painel do MP, não código (ver §8).

## Objetivo

Tornar o Checkout Transparente (Card Brick) o **caminho padrão de pagamento no
lançamento**, pronto para dinheiro real:

- Pagamento acontece **dentro do AutoStand**, sem redirect.
- Coleta de identidade da loja (CPF ou CNPJ) no cadastro, para registros/NF.
- Robustez de produção: anti-cobrança-dupla + UX de recusa de verdade.

**Fora de escopo (YAGNI, decidido no brainstorming):** device fingerprint (o Card
Brick já captura e associa ao token automaticamente — ganho marginal em assinatura),
telefone no cadastro, campos CPF+CNPJ separados, prefill do documento no Brick, e
troca para o Payment Brick (assinatura exige `card_token` → Card Payment Brick é o
correto).

## Fluxo (arquitetura)

```
/assinar (etapa 1)              coleta loja + admin + e-mail + senha + CPF/CNPJ
  └─ POST /api/assinar          cria tenant(incomplete), valida+salva documento,
                                assina paymentToken (HMAC), devolve
                                { paymentToken, amount, slug }
/assinar/pagamento (etapa 2)    Card Brick tokeniza o cartão no navegador
                                (nome + CPF do titular → card_token)
  └─ POST /api/assinar/pagamento  { paymentToken, card_token, payer_email }
        └─ createTransparentSubscription → PreApproval no MP → ativa o tenant
/assinar/sucesso
```

As peças centrais já existem (`CardBrick`, `lib/payment-token.ts`, as duas rotas,
`createTransparentSubscription`, o webhook). Este trabalho **enriquece e endurece**,
não reescreve. O redirect (`createCheckoutSession`) permanece no código como
**fallback de emergência**, mas deixa de ser o caminho padrão.

## Componentes

### 1. Coleta de identidade (CPF/CNPJ)

**Decisão:** um campo único "CPF ou CNPJ" com auto-detecção pelo número de dígitos.
Reaproveita o *nome do admin* como responsável (nenhum campo de nome novo).

- **Schema:** nova coluna `document` (text, dígitos normalizados sem máscara) em
  `tenants`, **nullable** (tenants existentes ficam `null`). Migração Drizzle. O nome
  `document` segue a convenção já usada em `sellers.document`.
- **`lib/br-document.ts` (novo):** não existe validador na base hoje. Expõe:
  - `normalizeDocument(raw) → string` (só dígitos)
  - `detectDocumentType(digits) → "cpf" | "cnpj" | null` (11 → cpf, 14 → cnpj)
  - `isValidDocument(raw) → boolean` (checksum oficial dos dígitos verificadores de
    CPF **e** CNPJ; rejeita sequências repetidas tipo `111.111.111-11`)
- **Form `/assinar` (`SignupForm.tsx`):** novo input "CPF ou CNPJ" com máscara
  dinâmica (troca CPF↔CNPJ conforme digita) e validação client via `br-document`.
  Enviado no body como `document`.
- **`/api/assinar`:** revalida `document` no servidor (`isValidDocument`); inválido →
  400 ("CPF ou CNPJ inválido."). Persiste os dígitos normalizados no `createTenant`.

**Propósito e limite:** o documento do cadastro é para **nossos registros / NF /
identidade da loja**. Ele **não** é repassado ao PreApproval — a API de assinatura do
MP não aceita identificação do pagador. O CPF que chega ao MP para pontuação é o do
**titular do cartão**, coletado pelo Card Brick (pt-BR, embutido no `card_token`).
Titular do cartão e documento da loja podem divergir; por isso **não** pré-preenchemos
o campo de documento do Brick (prefill continua só no e-mail, como já é).

### 2. Pontuação MP

Levers reais para **assinatura** (PreApproval), todos já presentes — apenas
confirmados, sem código novo:

- **`card_token`** carrega nome + CPF do titular (Card Brick em pt-BR). Confirmar que
  o campo de documento do Brick está ativo no ambiente.
- **`reason` = `"AutoStand {plano}"`** — a referência ao plano que o cliente pediu.
- **`external_reference` = `tenant.id`** — reconciliação e rastreio.
- **Conta verificada** — já existe.

Device fingerprint fica de fora (ver Objetivo): o Brick já o captura automaticamente.

### 3. Hardening — anti-cobrança-dupla

Buraco atual: em timeout ambíguo do MP (o MP **cria** a assinatura mas a resposta se
perde), o `catch` chama `releaseTenantCheckout` (processing→incomplete); um retry cria
uma **segunda** assinatura. A corrida de double-click já está fechada pelo CAS
(`claimTenantForCheckout`). Falta o caso do timeout/queda entre create e resposta.

**Solução (cinto + suspensório):**

- **Idempotency key estável** no create do PreApproval:
  `X-Idempotency-Key: sub-{tenantId}`. O MP deduplica retries dentro da janela dele
  (~24h) e devolve o mesmo resultado.
- **Search por `external_reference`** como reconciliação: no `catch`, antes de
  liberar, `preApproval.search({ external_reference: tenantId })`. Se já existir uma
  assinatura (authorized/pending), **reconcilia** (ativa ou marca pendente) em vez de
  criar outra. **Só libera** o tenant se o search confirmar que nada foi criado.

### 4. Hardening — UX de recusa

Buraco atual: o SDK do MP frequentemente **lança** erro (4xx) em recusa em vez de
devolver `status: "rejected"`; hoje isso cai no `catch` genérico → 502 "tente
novamente", mensagem errada para o usuário (o cartão foi recusado, não é falha
transitória). E `statusDetail` provavelmente vem `null` no PreApproval.

**Solução:** em `createTransparentSubscription` / `/api/assinar/pagamento`, inspecionar
o corpo do erro do MP e classificar em três baldes, mapeando `status_detail` / código
para mensagens claras em pt-BR:

- **Recusa do cartão (402):** retorna com mensagem específica e mantém o tenant
  reutilizável (após confirmar via search que nada foi criado). Mapa mínimo:
  - saldo insuficiente → "Cartão sem saldo/limite. Tente outro cartão."
  - código de segurança → "Código de segurança (CVV) inválido."
  - vencido → "Cartão vencido."
  - dados do form → "Confira os dados do cartão."
  - genérica de recusa → "Cartão recusado. Tente outro cartão."
- **Erro transitório (502):** timeout/5xx do MP → "Instabilidade no pagamento. Tente
  novamente." (com a reconciliação do §3 antes de liberar).
- **Config nossa (503):** credencial/token ausente → "Pagamento indisponível no
  momento." (não expõe detalhe; loga).

A forma exata do erro/recusa do MP **será validada no sandbox** (§7) e o mapa
ajustado ao que o MP realmente devolve.

### 5. Ligar o fluxo

- `CHECKOUT_MODE=transparent` como **var por ambiente** (GitHub Environments), ligado
  em homolog primeiro, depois prod.
- Envs necessárias por ambiente:
  - `NEXT_PUBLIC_MP_PUBLIC_KEY` — **build-time** (inlined). Cuidado com o
    [[turnstile-build-time-footgun]]: precisa estar presente no **build**, não só no
    runtime.
  - `PAYMENT_TOKEN_SECRET` — HMAC do paymentToken.
  - `MERCADOPAGO_ACCESS_TOKEN` — já existente.

## Fluxo de dados / erros

| Situação | Retorno API | Tenant | UX |
|---|---|---|---|
| Autorizado | 200 `authorized` | `authorized`→(webhook)`active` | vai pra /sucesso |
| Pendente | 200 `pending` | permanece; webhook reconcilia | /sucesso?pendente=1 |
| Já ativo (idempotente) | 200 `already_active` | inalterado | /sucesso |
| Recusa do cartão | 402 + mensagem específica | reutilizável (pós-search) | mostra erro, tenta outro cartão |
| Timeout ambíguo | reconcilia via search; 200 ou 502 | ativado se achou; senão liberado | /sucesso ou retry |
| Erro transitório MP | 502 | liberado (pós-search) | retry |
| Config ausente | 503 | inalterado | "indisponível" |

## Validação (§7)

- **Sandbox:** usuário-comprador de teste + cartões de teste do MP. O **nome do
  titular** controla o desfecho (`APRO` aprovado, `FUND` sem saldo, `SECU` CVV,
  `EXPI` vencido, `OTHE` recusa genérica, `CALL`, `FORM`…) → exercita cada ramo da UX
  de recusa e confirma a forma real do erro/`status_detail`. Cupom fixo derruba o
  Básico para ~R$1.
- **Real:** uma assinatura R$1 de ponta a ponta → confirmar tenant `active` →
  cancelar/limpar. Pode reaproveitar o diagnóstico do `/superadmin`, adaptando-o para
  exercitar o caminho transparente (não o redirect).

## Fora de código — painel do Mercado Pago (§8)

Tarefas operacionais do usuário (entregar como checklist):

- **Nome fantasia** da conta → "AutoStand".
- **Soft descriptor** da fatura do cartão → "AUTOSTAND" (o que o cliente vê no
  extrato; hoje tende a mostrar Synqo).

## Testes (§9)

- `tests/lib/br-document.test.ts` (novo) — CPF/CNPJ válidos e inválidos, sequências
  repetidas, máscara/normalização.
- `tests/api/assinar-mode.test.ts` — documento obrigatório + válido; persistência no
  tenant; ambos os modos (`transparent` e redirect).
- `tests/api/assinar-pagamento.test.ts` — idempotency key enviada; reconciliação por
  search no timeout (não cria 2ª assinatura); ramos de recusa mapeados para
  402/502/503 corretos.

## Arquivos afetados

- `lib/schema.ts` — coluna `document` em `tenants` + migração Drizzle.
- `lib/br-document.ts` — **novo** (normalize/detect/validate).
- `components/marketing/SignupForm.tsx` — campo CPF/CNPJ + máscara + validação.
- `app/api/assinar/route.ts` — valida + persiste `document`.
- `lib/checkout.ts` — idempotency key + search/reconcile + classificação de erro.
- `app/api/assinar/pagamento/route.ts` — mapa de recusa (402/502/503) + reconciliação.
- Config: `CHECKOUT_MODE`, `NEXT_PUBLIC_MP_PUBLIC_KEY`, `PAYMENT_TOKEN_SECRET` por
  ambiente (GitHub).
- Testes acima.
