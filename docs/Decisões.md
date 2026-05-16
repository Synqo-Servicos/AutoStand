---
title: Decisões
tags:
  - produto
  - decisoes
aliases:
  - ADR
  - Decision Log
---

# Decisões

> [!abstract] Resumo
> Registro das decisões de produto e arquitetura, com o racional. Decisões posteriores podem revisar as anteriores.

## Produto

> [!success] Nichado em concessionárias (não genérico)
> Reaproveita o modelo de veículos existente e entrega rápido. Generalizar para "qualquer catálogo" exigiria campos dinâmicos — over-engineering para um 2º segmento que talvez nunca venha. A arquitetura multi-tenant fica pronta caso se decida generalizar depois.

> [!success] Sem conta de consumidor final
> Quem compra carro o faz a cada 5+ anos; conta com login só adiciona fricção. O consumidor vira [[Glossário#Lead|lead]] (formulário sem senha). `users` é só staff. Os leads são a audiência do disparo futuro de email/WhatsApp.

> [!success] Sem trial — 1ª mensalidade ativa o site
> Substituiu a ideia inicial de "trial grátis". É B2B vendido a empresas — pagar o 1º mês é fricção baixa, filtra curioso e dá caixa imediato. A concessionária demo serve de "experimente antes".

> [!success] Subdomínio padrão + domínio próprio como upgrade
> Todo tenant nasce em `*.autostand.com.br` (site no ar na hora). Domínio próprio é upgrade (Pro/Premium), conectado depois. Domínio-próprio-only quebraria o "site instantâneo" (DNS não é self-service).

> [!success] Planos por funcionalidade, sem limite de veículos
> O mercado-alvo é homogêneo em tamanho (5–80 carros) — contagem não segmenta. Diferenciação por capabilities. Ver [[Planos e Preços]].

> [!success] Cadastro 100% automático
> Pagou → site no ar, sem aprovação manual do super-admin.

> [!success] Links de parceiro: desconto + atribuição
> Cada parceiro tem um cupom Stripe e um link `?parceiro=`. Registra-se de qual parceiro veio cada concessionária (relatório de atribuição).

## Precificação

Tiers a **R$197 / R$397 / R$697** (a validar com prospects). Racional:

- Precificar **pelo valor**, não pelo custo — uma concessionária que vende 1 carro a mais por causa do site já pagou o ano.
- Custo marginal de infra por tenant é baixo (~R$10–30/mês); o custo real que escala é o **tempo de suporte** — daí a importância da customização self-service.
- Argumento de venda: **mensalidade fixa, sem comissão por venda** (vs. Webmotors/iCarros).

## Arquitetura / Técnico

> [!success] Multi-tenancy: shared DB + `tenant_id`
> Banco único, resolução de tenant por header `Host`. Ver [[Arquitetura#Multi-tenancy]].

> [!success] Banco: Turso (libSQL) + Drizzle ORM
> Migrado de SQLite local (`better-sqlite3`), que não funciona em serverless. libSQL mantém o dialeto SQLite; Drizzle dá type-safety e migrations.

> [!success] Stripe para billing
> Checkout + Webhooks + Customer Portal. Ver [[Milestone 2]].

## Processo

> [!note] Continuar com Claude Code puro (Ruflo avaliado e descartado)
> O Ruflo (orquestração multi-agente) foi avaliado para a continuação. Descartado **para este projeto**: é alpha em rotação intensa, e o Milestone 2 é um build sequencial sensível a correção (billing) — pede execução revisável, não swarm autônomo.

> [!success] Nome: AutoStand
> Domínio `autostand.com.br` registrado no registro.br. Descritivos `.com.br` estavam saturados; "stand" é termo do setor.
