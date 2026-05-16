---
title: Visão Geral
tags:
  - produto
aliases:
  - Produto
  - Overview
---

# Visão Geral

> [!abstract] Resumo
> O [[Home|AutoStand]] vende, para cada concessionária cliente, um pacote pronto: **site público** (vitrine de estoque), **painel administrativo** (estoque, transações, leads) e hospedagem em **subdomínio** ou **domínio próprio**. Tudo roda numa única aplicação Next.js; o que separa um cliente do outro é o [[Arquitetura#Multi-tenancy|multi-tenancy]].

## Por que nichado em concessionárias

A plataforma é **deliberadamente especializada** em concessionárias, não genérica. O modelo de dados e as telas são afiados para venda de veículos (marca/modelo/ano/km, câmbio, combustível, leads). Generalizar para "qualquer catálogo" foi avaliado e descartado — ver [[Decisões]].

## Atores

| Ator | Quem é | Onde atua |
|---|---|---|
| **Super-admin** | O dono da plataforma. | Console (`/superadmin`). |
| **Admin da concessionária** (`tenant_admin`) | O gestor de um tenant. | Painel (`/admin`). |
| **Visitante** | Consumidor procurando carro. | Site público do tenant. |
| **Lead** | Visitante que deixou contato — **sem login**. | Capturado pelo site → CRM. |
| **Parceiro** | Indica clientes em troca de desconto. | Recebe um link; não acessa o sistema. |

> [!important] Não existe conta de consumidor final
> Quem compra carro usado o faz a cada 5+ anos — uma conta com login não entregaria valor e só adicionaria fricção. A tabela `users` é **só para staff**. O consumidor interage como [[Glossário#Lead|lead]]: preenche um formulário "Tenho interesse" sem senha. Ver [[Decisões]].

## Os três painéis

### 1. Console da plataforma — `/superadmin`
Acessível apenas nos hosts da plataforma. Dashboard com métricas, CRUD de concessionárias, criação do admin de cada uma.

### 2. Site público da concessionária
Servido no domínio/subdomínio do tenant. Vitrine de estoque com filtros, página de detalhe do veículo, formulário de captura de lead — tudo com o [[Arquitetura#Branding dinâmico|branding]] do tenant.

### 3. Painel da concessionária — `/admin`
Dashboard, **Veículos** (CRUD + fotos), **Transações** (entradas/saídas), **Leads** (CRM leve).

## Modelo de negócio

Hoje o super-admin cadastra concessionárias manualmente. O [[Milestone 2]] transforma isso em **self-service com cobrança recorrente via Stripe**:

1. O dono da concessionária chega na landing em `autostand.com.br`.
2. Escolhe um plano e assina via Stripe — **sem trial**: paga a 1ª mensalidade no cadastro.
3. O site é **provisionado automaticamente** e vai ao ar num subdomínio `*.autostand.com.br`.
4. Ele **personaliza o próprio site** (profundidade conforme o plano).
5. Assinatura vencida → site **suspenso** automaticamente.

> [!tip] Posicionamento
> Não somos "uma plataforma de sites" — somos **a operação de venda digital da concessionária**. O site é commodity; o que retém é a automação ([[Milestone 3]]). Ver [[Roadmap#Posicionamento]].

Detalhes de planos em [[Planos e Preços]].
