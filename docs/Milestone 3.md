---
title: Milestone 3 — Automação
tags:
  - planejamento
  - milestone
status: em-andamento
aliases:
  - M3
---

# Milestone 3 — Automação

> [!info] Status: em andamento
> O **motor de retenção**. Depois que o cliente tem site + assinatura ([[Milestone 1|M1]]–[[Milestone 2|M2]]), o que o faz **não cancelar** é a plataforma operar a venda para ele. É o que diferencia o produto de "só mais um site" — ver [[Roadmap#Posicionamento]]. O v1 (funil de leads + WhatsApp assistido) está concluído; faltam o **histórico de contato** (Eixo C) e a **automação real via WhatsApp Cloud API** (Eixo A).

## Eixo A — WhatsApp de leads

> [!success] WhatsApp assistido ✅ CONCLUÍDO
> Cada lead no funil tem **WhatsApp em 1 clique**: abre o `wa.me` do contato com uma mensagem-modelo pronta (saudação, follow-up, agendar test-drive). Enviar avança o lead de `novo` para `contatado`. Sem API, sem custo — o lojista mantém o WhatsApp dele.

## Eixo C — CRM ativo

> [!success] Funil de leads ✅ CONCLUÍDO
> `/admin/leads` deixou de ser lista plana e virou **quadro por estágio** (`novo` → `contatado` → `negociando` → `convertido` / `perdido`), com métrica de conversão e lembrete de leads novos parados sem contato. Ver [[Modelo de Dados#`leads` — CRM leve]].

---

# Plano do que falta

A ordem recomendada é **Eixo C primeiro** (rápido, sem dependência externa, já melhora o CRM e cria a base de timeline que o Eixo A vai alimentar), depois o **Eixo A em fases**.

```mermaid
graph LR
    C[Eixo C<br/>Histórico de contato<br/>rápido · sem dependência] --> A1[A.1 Conectar + Receber]
    A1 --> A2[A.2 Responder do painel]
    A2 --> A3[A.3 Automações]
    A3 --> A4[A.4 Campanhas + billing]
    class C,A1,A2,A3,A4 internal-link;
```

## Eixo C — Histórico de contato (fazer primeiro)

> [!todo] Objetivo
> Registrar **interação a interação** por lead (linha do tempo de contatos) — hoje só existe o estágio atual, sem histórico.

**Modelo de dados** — nova tabela `lead_interactions`:

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | pk | |
| `tenant_id` | FK → `tenants` (cascade, NOT NULL) | scoping multi-tenant ([[Arquitetura]]) |
| `lead_id` | FK → `leads` (cascade, NOT NULL) | |
| `user_id` | FK → `users` (nullable) | quem registrou; `null` = sistema/automação |
| `type` | enum (`lib/constants`) | `nota`, `whatsapp`, `ligacao`, `email`, `visita`, `mudanca_status`, `proposta` |
| `channel` | text opcional | `manual` \| `whatsapp_api` \| `sistema` |
| `body` | text | nota livre ou resumo |
| `metadata` | jsonb opcional | ex.: `{from,to}` de mudança de estágio; `wa_message_id` |
| `created_at` | timestamp | índice `(tenant_id, lead_id, created_at desc)` |

**Eventos auto-logados** (sem UI extra, instrumentando o que já existe):
- Mudança de estágio do lead → `mudanca_status` com `{from,to}`.
- Clique no WhatsApp assistido (que já avança p/ `contatado`) → `whatsapp`.
- Inbound/outbound da WhatsApp API (Eixo A) → `whatsapp` com `wa_message_id` (é o que **costura os dois eixos**).

**API & dados:**
- `GET /api/leads/[id]/interactions` (`withTenant`) — lista a timeline.
- `POST /api/leads/[id]/interactions` (`withTenant`, zod) — nota/ligação/visita manual.
- `lib/db/leads.ts`: `listLeadInteractions`, `addLeadInteraction`, e instrumentar `updateLeadStage` para logar na mesma transação.

**UI:** abrir o lead num `<Drawer>`/`<Modal>` (Camada 2 do [[Design System]]) com a timeline (ícone por tipo, autor, tempo relativo) + campo de nota rápida.

> [!tip] Gating
> Sugestão: **baseline** (todos os planos) — é CRM básico e aumenta retenção. O gate premium fica no Eixo A (automação).

**Esforço:** pequeno-médio (1 tabela, 2 endpoints, 1 drawer, instrumentar a mudança de estágio). Sem dependência externa.

## Eixo A — Automação real (WhatsApp Cloud API)

> [!todo] Objetivo
> Resposta automática pelo servidor, caixa de entrada no painel e campanhas — via **WhatsApp Business Cloud API (Meta)**.

### Decisões de arquitetura

> [!question] D1 — Cloud API direto (Meta) vs BSP
> **Cloud API direto** (modelo *Tech Provider*, via Embedded Signup) é mais barato e escala melhor, ao custo de mais setup (App Meta, verificação de negócio, gestão de templates). Um **BSP** (360dialog/Twilio/Gupshup/Z-API) acelera o MVP mas adiciona custo por mensagem e lock-in. **Recomendação:** Cloud API direto; BSP só se quiser um MVP muito rápido.

> [!question] D2 — Número por loja vs número único AutoStand
> **Número por loja** (recomendado): cada concessionária conecta o **próprio número** via Embedded Signup; AutoStand atua como *Tech Provider*. Mantém o whitelabel (o lead fala com a loja, não com a AutoStand). Cada tenant tem seu `waba_id` + `phone_number_id` + token. Número único AutoStand é mais simples mas fere o posicionamento.

> [!question] D3 — Janela de 24h
> Dentro de 24h da última mensagem do cliente: texto livre (sessão). Fora de 24h / proativo (campanhas): **só templates aprovados** (HSM) — categorias utility/marketing, com cobrança por conversa.

### Fluxo

```mermaid
sequenceDiagram
  participant Loja
  participant Painel as Painel /admin
  participant App as AutoStand (ECS)
  participant Meta as WhatsApp Cloud API
  participant Cliente

  Loja->>Painel: Conectar WhatsApp (Embedded Signup)
  Painel->>Meta: OAuth + escolha do número (WABA)
  Meta-->>App: code → troca por token (Tech Provider)
  App->>App: salva phone_number_id + token (Secrets Manager) em tenant_whatsapp
  Cliente->>Meta: mensagem para o número da loja
  Meta->>App: webhook inbound (X-Hub-Signature-256)
  App->>App: roteia por phone_number_id → tenant; casa/cria lead; loga no histórico (Eixo C)
  App-->>Painel: notifica (lead novo / nova mensagem)
  Painel->>App: responder (≤24h) ou enviar template
  App->>Meta: send message API
  Meta->>Cliente: entrega
  Meta->>App: webhook de status (delivered/read)
```

### Modelo de dados

- **`tenant_whatsapp`** (1:1 com tenant): `tenant_id`, `waba_id`, `phone_number_id`, `display_phone`, `token_ref` (referência ao **Secrets Manager**, nunca o token em texto), `status` (`pendente`/`conectado`/`erro`/`desconectado`), `connected_at`.
- **`whatsapp_messages`**: `tenant_id`, `lead_id` (nullable até casar), `wa_message_id`, `direction` (`in`/`out`), `type` (`text`/`template`/`image`…), `body`, `template_name`, `status` (`sent`/`delivered`/`read`/`failed`), `error`, `created_at`; índice `(tenant_id, lead_id, created_at)`.
- **`whatsapp_templates`** (opcional): `tenant_id`, `name`, `category`, `language`, `status` (aprovação Meta), `body` — ou gerir on-demand pela Graph API.

### Componentes

1. **Conexão (Embedded Signup):** fluxo no `/admin` para a loja autorizar; AutoStand (*Tech Provider*) troca o `code` pelo token e guarda `phone_number_id`/`waba_id` + token no **Secrets Manager** (não em texto na task def — alinhado com [[Arquitetura]] e a recomendação de segurança em [[Decisões]]). Subscribe do app ao WABA.
2. **Webhook único `POST /api/webhooks/whatsapp`:** verifica `X-Hub-Signature-256` (HMAC com o app secret — **mesmo padrão** do webhook do Mercado Pago, ver [[Milestone 2]]); `GET` para o verify-challenge. Roteia inbound por `phone_number_id` → tenant; casa por telefone com lead existente ou **cria lead** (`source: whatsapp`); grava em `whatsapp_messages` e registra a interação no **Eixo C**.
3. **Envio (`lib/whatsapp.ts`):** wrapper da Graph API — `sendText` (sessão ≤24h) e `sendTemplate` (proativo). Rate limit (reaproveita o Upstash de `lib/ratelimit.ts`) e tratamento de erro.
4. **Caixa de entrada no painel:** thread de mensagens no `/admin/leads/[id]` — responder na janela ou escolher template fora dela.
5. **Automação (regras):** auto-resposta de saudação, "fora do horário", captura de lead do inbound. Depois: **rascunho assistido por IA** (reaproveita `lib/ai.ts`/Anthropic) com **humano no loop**.
6. **Campanhas:** disparo em massa de template a um segmento (ex.: "chegou SUV novo"), respeitando opt-in, categoria marketing e os limites de qualidade da Meta.

### Fases

| Fase | Entrega | Valor |
|---|---|---|
| **A.1 — Conectar + Receber (MVP)** | Embedded Signup, webhook inbound, inbound→lead, log no histórico. *Sem envio automático ainda.* | Centraliza os leads de WhatsApp no painel |
| **A.2 — Responder do painel** | Envio em sessão (≤24h) + templates aprovados; caixa de entrada | Operar a conversa sem sair do AutoStand |
| **A.3 — Automações** | Auto-resposta, fora-do-horário, rascunho com IA (humano confirma) | Reduz tempo de resposta |
| **A.4 — Campanhas + billing** | Disparo segmentado + medição de uso/custo por conversa | Reativação e upsell |

### Custos, compliance e infra

> [!warning] Pontos de atenção
> - **Custo por conversa** (Meta cobra por categoria marketing/utility/service) — modelar como **add-on/4º tier Premium** (ver [[Planos e Preços]] e a nota de tiering abaixo) e **medir uso por tenant**.
> - **Onboarding da Meta** (verificação de negócio, aprovação de templates) é burocrático e lento — **começar cedo**.
> - **Qualidade do número:** a Meta rebaixa números com muitos bloqueios — moderar campanhas.
> - **LGPD / opt-in / opt-out (STOP)** e a regra da janela de 24h.

**Envs novos:** `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`; tokens por tenant no **Secrets Manager** (não na task def). O webhook público já é coberto pelo ALB ([[Arquitetura]]).

## Posição no roadmap

Vem depois do [[Milestone 2]] (billing). O **Eixo A é o candidato natural a um 4º tier / add-on Premium** — é o recurso de maior valor percebido e reforça a justificativa do plano Premium (ver [[Planos e Preços]]). O **Eixo C (histórico)** pode ser baseline, já que é CRM básico.

---

## Vale a pena? — validação do esforço (WhatsApp Cloud API)

> [!question] A pergunta honesta
> O **Eixo A** assume que a automação real via **WhatsApp Business Cloud API** é o motor de retenção ([[Roadmap#Posicionamento]]). Antes de gastar semanas de engenharia + burocracia da Meta, vale separar o que é **convicção de posicionamento** do que é **retorno comprovado**. Esta seção é uma análise de decisão balanceada — não um plano de execução (o plano está acima, em Eixo A).

### 1. Valor — o que destrava, e quanto disso é incremental

O argumento de retenção é real ([[Roadmap#Posicionamento]], modelo Anota.ai). A Cloud API destrava três coisas que o `wa.me` não faz: **resposta automática pelo servidor**, **caixa de entrada no painel** (a conversa vive no `/admin`, costurada ao histórico do Eixo C) e **campanhas proativas** (disparo de template a um segmento — impossível com `wa.me`).

> [!warning] O teto do incremental é menor do que parece
> O **WhatsApp assistido (`wa.me`) já está entregue, custa zero e resolve ~70% da dor**. O delta real da Cloud API é (a) automação sem humano e (b) campanhas proativas. Para uma revenda independente com 1 vendedor e 30 carros, "responder do painel em vez do celular" pode ter **valor percebido baixo**. O valor de campanha depende de **base opt-in** e **giro de estoque**, que nem toda loja pequena tem. O valor é **real mas concentrado** nas lojas maiores/mais ativas — o perfil de quem pagaria um tier mais caro.

### 2. Esforço — magnitude realista

Não é uma feature, é uma **integração regulada com onboarding externo**. As fases A.1–A.4 escondem dois custos diferentes:

| Fase | Engenharia | Custo "invisível" (externo) |
|---|---|---|
| **A.1 — Conectar + Receber** | Médio: Embedded Signup (Tech Provider), webhook verify+inbound, roteamento por `phone_number_id`→tenant | **Alto, fora do nosso controle:** App Meta, verificação de negócio, app review. Semanas. |
| **A.2 — Responder do painel** | Médio: `lib/whatsapp.ts`, caixa de entrada, status | Aprovação de **templates HSM** (review da Meta) |
| **A.3 — Automações** | Baixo-médio: regras + rascunho IA (reusa `lib/ai.ts`) | Qualidade do número / moderação |
| **A.4 — Campanhas + billing** | **Alto:** segmentação, opt-in, medição de custo por tenant | Limites de qualidade / conciliação de custo |

**Reuso real no código:** o webhook reaproveita o **mesmo padrão HMAC** já em produção no Mercado Pago (`createHmac("sha256")` + `timingSafeEqual` em `app/api/webhooks/mercadopago/route.ts:10`); rate limit reusa `lib/ratelimit.ts`; rascunho assistido reusa `lib/ai.ts`; lead por canal já tem `source` (`lib/db/leads.ts:8`). A **engenharia é tratável** — o gargalo é A.1 (onboarding Meta) e A.4 (billing), por **dependência externa e operação contínua**, não por dificuldade técnica.

### 3. Custo — modelo de cobrança da Meta

> [!warning] Os valores exatos mudam — sempre conferir a tabela atual da Meta
> A Meta **aposentou a cobrança por "conversa" de 24h** e migrou para **preço por mensagem (template)** ao longo de 2025. As faixas abaixo são **ordem de grandeza para o Brasil** — não use para faturar sem reconferir na tabela oficial vigente.

| Categoria | Quando | Faixa BR (≈, **verificar**) | Quem dispara |
|---|---|---|---|
| **Marketing** | Promoção, reativação | ~R$0,30–0,40 / msg | Campanhas (A.4) — **o custo que come margem** |
| **Utility** | Pós-venda, lembrete | ~R$0,04–0,06 / msg | Automações utilitárias |
| **Service** (iniciada pelo cliente) | Resposta ≤24h do inbound | **Grátis** | A.1/A.2 |

**Leitura prática:** o uso operacional (cliente manda → loja responde em 24h) é **basicamente de graça**. O custo nasce em **campanhas marketing** — 500 msgs/mês ≈ **R$150–200/mês** só de mídia, número que **rivaliza com a própria mensalidade** ([[Planos e Preços]]).

> [!danger] Quem paga
> Se a AutoStand **absorver** o custo de mensagem, uma loja que abusa de campanha **destrói a margem** de um tier de R$ 169–499. Decisão obrigatória antes de A.4: **a loja paga a mídia da Meta** (repasse/créditos) e a AutoStand cobra a **plataforma** como add-on. Ver [[Decisões]].

### 4. Alternativas

| | (a) Só `wa.me` assistido | (b) BSP (Z-API/360dialog/Twilio) | (c) Cloud API direto |
|---|---|---|---|
| Status | **Já entregue** | A construir | A construir |
| Setup/burocracia | Zero | Baixo (BSP cuida da Meta) | **Alto** |
| Custo recorrente | **R$ 0** | Mídia Meta + fee do BSP + lock-in | Mídia Meta (mais barato em escala) |
| Automação/inbox | Não | Sim | Sim |
| Campanhas | Não | Sim | Sim |
| Time-to-market | — | **Rápido** | Lento |
| Margem em escala | Total | Menor | **Maior** |

> [!tip] O ponto cego do plano
> A decisão D1 recomenda **Cloud API direto** e trata BSP como "MVP rápido". Para **validar willingness-to-pay**, o MVP rápido é exatamente o que se quer: um **BSP no piloto** corta o onboarding de semanas para dias, prova a feature com 3–5 lojas reais, e **só então** justifica migrar para Cloud API direto. BSP não é o plano B — é o **instrumento de validação barato**.

### 5. Veredito e recomendação

> [!success] Veredito: **vale a pena — mas faseado, gated e validado por demanda, não construído por convicção.**
> Coerente com o posicionamento e candidato natural a **4º tier / add-on Premium** ([[Planos e Preços]]). Mas o incremental sobre o `wa.me` gratuito é **concentrado**, o custo de marketing **ameaça a margem**, e o gargalo é **externo (Meta)**. Logo: **não é prioridade sobre o que já gera receita** — entra **depois** do billing ([[Milestone 2]]) e **depois do Eixo C**.

**Sequência (menor risco → maior):**
1. **Eixo C primeiro** (histórico) — barato, sem dependência externa, costura os dois eixos. Fazer já.
2. **Validar willingness-to-pay antes de qualquer código de API** — sem ≥3 lojas dizendo "sim e pago", não começar A.1.
3. **Piloto via BSP** com essas lojas — prova em dias.
4. **Migrar para Cloud API direto** só quando o volume amortizar o setup e a margem fechar com repasse de mídia.

> [!example] Critérios de go/no-go
> **GO** se *todos*: ≥3 lojas confirmam que **pagariam** o add-on; modelo de cobrança da mídia **definido** (loja paga a Meta); Eixo C entregue; billing do [[Milestone 2]] concluído.
> **NO-GO / adiar** se *qualquer*: demanda morna ("`wa.me` já basta"); sem dono para a operação contínua; custo de marketing sem repasse claro; verificação Meta travada.

> [!note] Resumo de uma linha
> Construa — **por etapas, como add-on Premium pago com mídia repassada à loja, validando demanda antes do código e usando BSP no piloto**. Comece pelo Eixo C. O `wa.me` gratuito segue como baseline válido até os critérios de GO baterem.
