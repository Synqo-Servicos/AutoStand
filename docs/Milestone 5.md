---
title: Milestone 5 — Inteligência de Demanda
tags:
  - planejamento
  - milestone
status: em-andamento
aliases:
  - M5
---

# Milestone 5 — Inteligência de Demanda

> [!info] Status: em andamento
> Transformar o comportamento de quem compra em **sinal de demanda** para a concessionária — o que o mercado procura, para a loja decidir estoque com dado em vez de achismo. Fases 1–3 concluídas.

## Decisões que orientam o milestone

Ver [[Decisões]] para o racional. Em resumo:

- **Eventos anônimos.** Registra-se só o *comportamento* (filtros usados, atributos dos veículos vistos) — nunca dado pessoal. Não é um audit-log de segurança; é analítico.
- **O agregado do marketplace é o dado único.** Uma loja sozinha só vê o próprio tráfego; a AutoStand vê a demanda de toda a rede. Esse agregado **só a plataforma tem** — é o que justifica o tier.
- **Recurso do plano Premium** (capability `marketInsights`) — mesma faixa da Análise IA.
- **Captura no servidor**, fire-and-forget — telemetria nunca derruba a navegação.

## Fases

> [!success] Fase 1 — Captura de eventos ✅ CONCLUÍDA
> Tabela `demand_events` (migration 0005). `lib/demand.ts` registra **buscas** e **visualizações** em 4 pontos: `/comprar` e o site de cada loja (buscas); `/comprar/[id]` e `/veiculos/[id]` (visualizações). `tenant_id` null = marketplace; preenchido = site da loja. Ver [[Modelo de Dados#`demand_events`]].

> [!success] Fase 2 — Painel de inteligência ✅ CONCLUÍDA
> `/admin/inteligencia` (Premium) — dois snapshots de 30 dias: **demanda no marketplace** (o mercado todo) e **demanda no site da loja**. Rankings de marcas, faixas de preço, carrocerias e cidades mais buscadas, e veículos mais vistos.

> [!success] Fase 3 — Dicas por IA ✅ CONCLUÍDA
> `gerarDicasDemanda` (`lib/ai.ts`) lê os snapshots e devolve recomendações de estoque e anúncio em linguagem natural, sob demanda. Depende de `ANTHROPIC_API_KEY` — o painel de números funciona sem a chave.

> [!todo] Futuro — tendências e alertas
> Evolução temporal (semana a semana), comparação de períodos e alertas proativos ("procura por SUV subiu 30%"). Ainda não implementado.

## Relação com os outros milestones

- A captura depende do marketplace e dos sites do [[Milestone 4]] e do [[Milestone 1]].
- O **gating** usa as capabilities do [[Milestone 2]] — ver [[Planos e Preços]].
- Reforça o plano Premium, hoje o tier mais fraco — ver [[Planos e Preços]].

## Pendências de negócio

- A inteligência só "acende" com tráfego real; no beta, o seed popula eventos sintéticos para a demo não nascer vazia.
- Filtragem de bots na captura — aceitável ignorar no v1, a revisar com volume.
