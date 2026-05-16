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
> Transformar o cadastro manual de concessionárias em **auto-serviço com cobrança recorrente via Stripe**, e tornar a customização do site um recurso escalonado por plano. **Fase 1 concluída.**

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

> [!todo] Fase 2 — Stripe: Checkout + Webhooks
> `lib/stripe.ts`; `POST /api/checkout` (subscription, cobrança imediata da 1ª mensalidade); `POST /api/webhooks/stripe` (provisiona o tenant, sincroniza status, suspende). **Depende de:** conta Stripe + chaves.

> [!todo] Fase 3 — Landing page + cadastro
> Landing de vendas em `autostand.com.br`; `/assinar` (escolhe plano + subdomínio + dados do admin → tenant `incomplete` → Checkout; lê `?parceiro=`); `/assinar/sucesso`.

> [!todo] Fase 4 — Sistema de layouts/temas
> O site público renderiza a partir de `layout_config`: variantes de hero, 4-5 estilos de card, cards por fila. **A fase mais pesada.**

> [!todo] Fase 5 — Customização self-service
> `/admin/personalizar` — editor com preview ao vivo; controles liberados/travados por `capabilities` do plano.

> [!todo] Fase 6 — Billing no painel + gating
> `/admin/assinatura` (plano, Stripe Customer Portal); gating por plano; tenant suspenso → página "indisponível".

> [!todo] Fase 7 — Links de parceiro
> `/superadmin/parceiros` — cria parceiro → cupom Stripe → link `?parceiro=`. Relatório de atribuição.

> [!todo] Fase 8 — Análises de IA (Premium)
> IA analisa a customização e dá recomendações. Tratar como sub-projeto de IA com spec próprio.

> [!todo] Fase 9 — Wildcard domain + deploy
> Wildcard `*.autostand.com.br` na Vercel; `lib/tenant.ts` resolve `<slug>.autostand.com.br` por slug; envs do Stripe + webhook.

## Ordem e riscos

> [!warning]
> Ordem de dependência: 1 → 2 → 3 → (4 → 5) → 6 → 7 → 8 → 9. A **Fase 4** é a mais pesada (sistema de variantes de layout). A **Fase 8 (IA)** é a mais incerta.

## Pendências de negócio

- Conta Stripe + chaves de API (modo teste serve para desenvolver).
- Validar os preços (R$197 / R$397 / R$697) com prospects reais.
