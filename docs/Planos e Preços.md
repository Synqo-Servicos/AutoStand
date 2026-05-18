---
title: Planos e Preços
tags:
  - produto
  - billing
aliases:
  - Planos
  - Pricing
  - Tiers
---

# Planos e Preços

> [!abstract] Resumo
> 3 tiers diferenciados **por funcionalidade** — sem limite de veículos. Definidos em `lib/plans.ts`. Preços são ponto de partida, a validar com prospects.

## Os 3 tiers

| | **Básico** | **Pro** ⭐ | **Premium** |
|---|---|---|---|
| Preço/mês | R$197 | R$397 | R$697 |
| Site + vitrine + CRM de leads | ✓ | ✓ | ✓ |
| Cores da marca | ✓ | ✓ | ✓ |
| Subdomínio `loja.autostand.com.br` | ✓ | ✓ | ✓ |
| Domínio próprio | — | ✓ | ✓ |
| Customização de layout (hero, cards, seções) | — | ✓ | ✓ |
| Gerador de post para Instagram | — | ✓ | ✓ |
| Análises de IA | — | — | ✓ |

## Capabilities

`lib/plans.ts` mapeia cada tier para um conjunto de `capabilities` lido pelo gating:

| Capability | Básico | Pro | Premium |
|---|---|---|---|
| `customColors` | ✓ | ✓ | ✓ |
| `layoutConfig` | — | ✓ | ✓ |
| `customDomain` | — | ✓ | ✓ |
| `instagramPost` | — | ✓ | ✓ |
| `aiAnalysis` | — | — | ✓ |

Helpers: `getPlan(slug)`, `capabilitiesFor(slug)`. Tenant sem `plan` definido cai nas capabilities do Básico.

## Racional

> [!important] Sem limite de veículos
> O mercado-alvo (revendas multimarca **independentes**) é homogêneo: loja pequena tem 5–15 carros, a típica ~30, e o teto realista ~80. Concessionárias de marca (ex.: complexo JRCA) **estão fora do escopo**. Contagem de veículos não consegue segmentar planos nesse cenário — a diferenciação é 100% por funcionalidade. Ver [[Decisões]].

- A **leitura de cada plano:**
	- **Básico** — "estar online de forma decente": site completo, com a cor da marca, no subdomínio.
	- **Pro** — "parecer uma marca de verdade": domínio próprio, site customizado e gerador de post para Instagram.
	- **Premium** — "o extra inteligente": IA hoje; ganha peso com a automação do [[Milestone 3]].

> [!warning] Premium hoje é o tier mais fraco
> Apoia-se só na IA. Ganha justificativa real com o [[Milestone 3]] (automação WhatsApp + sindicância). Provável gancho para um 4º tier no futuro.

## Cobrança

- **Sem trial** — o cliente paga a 1ª mensalidade no cadastro e o site vai ao ar. A concessionária demo (`demo.autostand.com.br`) é a vitrine de "experimente antes".
- Plano anual com desconto (2 meses grátis) — recomendado, a adicionar.
- **Links de parceiro** aplicam cupom de desconto — ver [[Milestone 2]] Fase 7.

Custos de infra e racional de precificação: ver [[Decisões#Precificação]].
