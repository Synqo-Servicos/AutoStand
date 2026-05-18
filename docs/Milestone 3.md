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
> O **motor de retenção**. Depois que o cliente tem site + assinatura ([[Milestone 1|M1]]–[[Milestone 2|M2]]), o que o faz **não cancelar** é a plataforma operar a venda para ele. É o que diferencia o produto de "só mais um site" — ver [[Roadmap#Posicionamento]]. O v1 (funil de leads + WhatsApp assistido) está concluído.

## Eixo A — WhatsApp de leads

> [!success] WhatsApp assistido ✅ CONCLUÍDO
> Cada lead no funil tem **WhatsApp em 1 clique**: abre o `wa.me` do contato com uma mensagem-modelo pronta (saudação, follow-up, agendar test-drive). Enviar avança o lead de `novo` para `contatado`. Sem API, sem custo — o lojista mantém o WhatsApp dele.

> [!todo] Automação real (WhatsApp Business API)
> Resposta automática pelo servidor e disparo de campanhas dependem da **WhatsApp Business API (Meta)** — conta Meta Business, número dedicado que sai do app comum, e cobrança por conversa. Fase posterior, quando houver escala que justifique o custo.

> [!info] Eixo B migrou para o [[Milestone 4]]
> A sindicância de estoque em marketplaces (publicar o veículo nos portais externos — OLX, Webmotors, iCarros) virou a **Fase 4 do [[Milestone 4]]**, junto com o marketplace próprio da AutoStand. Distribuição ficou concentrada num milestone só.

## Eixo C — CRM ativo

> [!success] Funil de leads ✅ CONCLUÍDO
> `/admin/leads` deixou de ser lista plana e virou **quadro por estágio** (`novo` → `contatado` → `negociando` → `convertido` / `perdido`), com métrica de conversão e lembrete de leads novos parados sem contato. Ver [[Modelo de Dados#`leads` — CRM leve]].

> [!todo] Histórico de contato
> Registrar interação a interação por lead (linha do tempo de contatos) — ainda não implementado.

## Posição no roadmap

Vem depois do [[Milestone 2]] (billing). Provável gancho para um **4º tier** ou add-on premium, já que é o recurso de maior valor percebido — reforça a justificativa do plano Premium (ver [[Planos e Preços]]).
