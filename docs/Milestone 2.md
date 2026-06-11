---
title: Milestone 2 — Self-service + Billing
tags:
  - planejamento
  - milestone
status: em-andamento
aliases:
  - M2
---

# Milestone 2 — Self-service + Billing

> [!info] Status: em andamento
> Transformar o cadastro manual de concessionárias em **auto-serviço com cobrança recorrente via Mercado Pago**, e tornar a customização do site um recurso escalonado por plano. **Fases 1 e 3–9 concluídas; falta só a Fase 2 (pagamento).**

## Decisões que orientam o milestone

Ver [[Decisões]] para o racional completo. Em resumo:

- 3 tiers por funcionalidade, sem limite de veículos — ver [[Planos e Preços]].
- **Sem trial** — paga a 1ª mensalidade e o site vai ao ar; a demo é a vitrine.
- Cadastro 100% automático.
- Subdomínio `*.autostand.com.br` é o padrão; domínio próprio é upgrade.
- Links de parceiro: desconto + atribuição.

## Fases

> [!success] Fase 1 — Modelo de dados ✅ CONCLUÍDA
> `tenants` ganhou campos de billing (`plan`, `stripe_*`, `subscription_status`, `current_period_end`, `referred_by`, `layout_config`). Nova tabela `partners`. `lib/plans.ts` (tiers + capabilities) e `lib/layout.ts` (`LayoutConfig`). Migration aplicada, seed atualizado. Ver [[Modelo de Dados]] e [[Planos e Preços]].

> [!todo] Fase 2 — Pagamento: Checkout + Webhooks
> **Atualização (jun/2026):** implementado com **Mercado Pago** (Preapproval) na migração AWS + Mercado Pago — `lib/checkout.ts` e `POST /api/webhooks/mercadopago`. O plano original (Stripe) abaixo fica como registro histórico.
> Plano original: `lib/stripe.ts`; `POST /api/checkout` (subscription, cobrança imediata da 1ª mensalidade); `POST /api/webhooks/stripe` (provisiona o tenant, sincroniza status, suspende). **Dependia de:** conta Stripe + chaves.

> [!success] Fase 3 — Landing page + cadastro ✅ CONCLUÍDA
> Landing institucional em `autostand.com.br` + `/assinar` (escolhe plano + subdomínio + dados do admin → cria tenant `incomplete`/`suspended` + admin; lê `?parceiro=`) + `/assinar/sucesso`. `POST /api/assinar`, validação de slug (`lib/slug.ts`). O `(public)` ramifica por host (plataforma vs tenant). O Checkout é um **seam** (`lib/checkout.ts`) que a Fase 2 preenche.

> [!success] Fase 4 — Sistema de layouts/temas ✅ CONCLUÍDA
> O storefront renderiza a partir de `layout_config`: 3 estilos de hero (`StorefrontHero`), 5 estilos de card (`VehicleCard`), 3 ou 4 cards por fila. `resolveLayoutConfig` preenche os padrões. A concessionária demo recebeu um `layout_config` distinto no seed para servir de vitrine lado a lado.

> [!success] Fase 5 — Customização self-service ✅ CONCLUÍDA
> `/admin/personalizar` — editor (`PersonalizarEditor`) com preview **client-side** ao vivo, reaproveitando `StorefrontHero`/`VehicleCard`. Cores e textos do hero para todos os planos; layout (`layout_config`) liberado/travado por `capabilitiesFor`. `PATCH /api/personalizar` com gating também no servidor.

> [!success] Fase 6 — Billing no painel + gating ✅ CONCLUÍDA
> Loja não-ativa → página "indisponível" (`LojaIndisponivel`); painel acessível mesmo suspenso (`getAdminTenant`) com banner de pendência; `/admin/assinatura` read-only (plano, status, capabilities). Gestão de pagamento = seam da Fase 2. Ativação pré-Stripe é manual pelo `/superadmin`.

> [!success] Fase 7 — Links de parceiro ✅ CONCLUÍDA
> `/superadmin/parceiros` — CRUD de parceiros; código reutilizável `?parceiro=` com **limite de usos** e **validade** opcionais (`max_uses`/`expires_at`); link copiável; relatório de atribuição (concessionárias por parceiro). `getPartnerByCode` checa os limites no cadastro. O cupom no provedor de pagamento é seam da Fase 2.

> [!success] Fase 8 — Análises de IA (Premium) ✅ CONCLUÍDA
> `/admin/analise` — análise sob demanda da vitrine (marca, layout, catálogo) com recomendações estruturadas. Anthropic via Vercel AI SDK (`lib/ai.ts`); gated por Premium no servidor e na UI. Chave em `ANTHROPIC_API_KEY` (modelo via `AI_MODEL`).

> [!success] Fase 9 — Wildcard domain ✅ CONCLUÍDA (código)
> `lib/tenant.ts` resolve `<slug>.autostand.com.br` por slug (domínio-base via env `PLATFORM_DOMAIN`). A configuração do wildcard `*.autostand.com.br` na Vercel é operacional — ver [[Desenvolvimento#Deploy (Vercel)]]. Os envs do provedor de pagamento entram com a Fase 2.

## Ordem e riscos

> [!warning]
> Ordem de dependência: 1 → 2 → 3 → (4 → 5) → 6 → 7 → 8 → 9. A **Fase 4** é a mais pesada (sistema de variantes de layout). A **Fase 8 (IA)** é a mais incerta.

## Pendências de negócio

- Conta Stripe + chaves de API (modo teste serve para desenvolver).
- Validar os preços (R$ 169,90 / R$ 349,90 / R$ 499,90) com prospects reais.
