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
> 2 tiers diferenciados **por funcionalidade** — sem limite de veículos. Definidos em `lib/plans.ts`. Preços são ponto de partida, a validar com prospects.

## Os 2 tiers

| | **Pro** | **Premium** ⭐ |
|---|---|---|
| Preço/mês | R$ 249,90 | R$ 349,90 |
| Site + vitrine + CRM de leads | ✓ | ✓ |
| Cores da marca | ✓ | ✓ |
| Subdomínio `loja.autostand.com.br` | ✓ | ✓ |
| Domínio próprio | ✓ | ✓ |
| Customização de layout (hero, cards, seções) | ✓ | ✓ |
| Gerador de post para Instagram | ✓ | ✓ |
| Análises de IA | — | ✓ |
| Inteligência de demanda | — | ✓ |

## Capabilities

`lib/plans.ts` mapeia cada tier para um conjunto de `capabilities` lido pelo gating:

| Capability | Pro | Premium |
|---|---|---|
| `customColors` | ✓ | ✓ |
| `layoutConfig` | ✓ | ✓ |
| `customDomain` | ✓ | ✓ |
| `instagramPost` | ✓ | ✓ |
| `aiAnalysis` | — | ✓ |
| `marketInsights` | — | ✓ |

Helpers: `getPlan(slug)`, `capabilitiesFor(slug)`, `ENTRY_PLAN`. Tenant sem `plan` definido — e o slug legado `basico` — caem nas capabilities do Pro.

> [!warning] Quatro capabilities estão ligadas nos dois planos
> `layoutConfig`, `customDomain`, `instagramPost` e `customColors` não separam mais nada: o gating no servidor continua lá, mas nenhum plano vendido cai nele. É código vivo só para o dia em que um tier mais barato voltar — não confunda a existência da capability com a existência de um plano que a nega.

## Racional

> [!important] Por que o Básico morreu (set/2026)
> O Básico (R$ 169,90, sem domínio próprio) vendia **"site"** — e a [[concorrente-autocerto|AutoCerto]] dá site de graça no plano de R$ 150. Competir por "estar online de forma decente" era entrar numa briga já perdida. A divisória que sobrou é a única que o concorrente não copia do catálogo dele: **o site inteiro** vs. **o sistema decidindo junto**.

> [!important] Sem limite de veículos
> O mercado-alvo (revendas multimarca **independentes**) é homogêneo: loja pequena tem 5–15 carros, a típica ~30, e o teto realista ~80. Concessionárias de marca (ex.: complexo JRCA) **estão fora do escopo**. Contagem de veículos não consegue segmentar planos nesse cenário — a diferenciação é 100% por funcionalidade. Ver [[Decisões]].

- A **leitura de cada plano:**
	- **Pro** — "a loja inteira online": site completo no domínio próprio da loja, com layout e cores da marca, painel de gestão, CRM de leads e gerador de post para Instagram.
	- **Premium** — "o extra inteligente": análise de IA da vitrine e **inteligência de demanda** — saber o que o mercado procura. Ganha mais peso com a automação do [[Milestone 3]].

> [!note] O Premium é o card destacado
> Com dois planos, o selo "Mais escolhido" saiu: sem base instalada, era afirmação sem dado. O destaque agora é factual — "Inteligência de demanda", o que o plano tem.

## Cobrança

- **Sem trial** — o cliente paga a 1ª mensalidade no cadastro e o site vai ao ar. A concessionária demo (`demo.autostand.com.br`) é a vitrine de "experimente antes".
- **Domínio próprio incluído nos dois planos**, sem cobrança à parte — um `.com.br` custa ~R$3,33/mês e não sustenta linha de cobrança própria. Cliente sem domínio: registra-se e repassa-se **no custo, uma vez só**, com o registro **no nome do cliente** (evita reter o ativo dele num churn).
- Plano anual com desconto (2 meses grátis) — recomendado, a adicionar.
- **Links de parceiro** aplicam cupom de desconto — ver [[Milestone 2]] Fase 7.
- O cupom `free_month` (`lib/coupon-pricing.ts` → `free_trial` no MP) dá o 1º mês grátis sem precisar de código novo.

Custos de infra e racional de precificação: ver [[Decisões#Precificação]].
