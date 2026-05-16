---
title: Milestone 3 — Automação & Distribuição
tags:
  - planejamento
  - milestone
status: planejado
aliases:
  - M3
---

# Milestone 3 — Automação & Distribuição

> [!info] Status: planejado
> O **motor de retenção**. Depois que o cliente tem site + assinatura ([[Milestone 1|M1]]–[[Milestone 2|M2]]), o que o faz **não cancelar** é a plataforma operar a venda para ele. É o que diferencia o produto de "só mais um site" — ver [[Roadmap#Posicionamento]].

## Eixo A — Automação de leads no WhatsApp

- Resposta automática a novos [[Glossário#Lead|leads]] (capturados pelo site) no WhatsApp.
- Qualificação do lead no funil; lembretes de follow-up para o vendedor.
- Agendamento de test-drive.
- Disparo de campanhas (email + WhatsApp) para a base de leads.

> [!warning] Custo a considerar
> A WhatsApp Business API (Meta) cobra por conversa.

## Eixo B — Sindicância de estoque em marketplaces

- A concessionária cadastra o veículo **uma vez** e ele é publicado automaticamente nos portais (Webmotors, OLX, Mercado Livre, iCarros).
- Elimina o retrabalho de recadastrar o mesmo carro em 4 sites na mão — dor real e cara do setor.
- Sincroniza disponibilidade: vendeu na plataforma → sai dos portais.

> [!note]
> Depende da API/integração disponível em cada portal — a investigar por portal.

## Eixo C — CRM ativo

- Evoluir o `/admin/leads` de lista simples para **funil** — histórico de contato, estágios e métricas de conversão.

## Posição no roadmap

Vem depois do [[Milestone 2]] (billing). Provável gancho para um **4º tier** ou add-on premium, já que é o recurso de maior valor percebido — reforça a justificativa do plano Premium (ver [[Planos e Preços]]).
