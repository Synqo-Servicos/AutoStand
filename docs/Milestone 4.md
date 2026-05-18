---
title: Milestone 4 — Distribuição & Marketplace
tags:
  - planejamento
  - milestone
status: em-andamento
aliases:
  - M4
---

# Milestone 4 — Distribuição & Marketplace

> [!info] Status: em andamento
> Levar o estoque da concessionária **até o comprador** — não só hospedar o site dela. Gerar conteúdo de divulgação, um marketplace próprio e, no futuro, distribuir nos portais externos. Fases 1–3 concluídas.

## Decisões que orientam o milestone

Ver [[Decisões]] para o racional. Em resumo:

- **Marketplace é opt-in, em todos os planos.** A loja escolhe aparecer; no início, densidade de inventário importa mais que gating.
- **O marketplace afunila para o site whitelabel** da loja — é topo de funil, não substitui o produto que o lojista paga.
- **Marca AutoStand mantida** no marketplace v1; uma marca de consumidor própria fica para quando houver tração.
- **Sem ranking no v1** — ordenação neutra por recência; ranking de reputação exige dados que ainda não temos.
- O post de Instagram **não leva marca da plataforma** — a peça é da loja (whitelabel).

## Fases

> [!success] Fase 1 — Campos estruturados do veículo ✅ CONCLUÍDA
> `vehicles` ganhou `version`, `year_manufacture`, `body_type`, `condition`, `optionals` (JSON), `armored`, `single_owner` e `fipe_code` (migration 0003). Pré-requisito do gerador de post e dos feeds de portal — ver [[Modelo de Dados#`vehicles`]]. O formulário do `/admin` ganhou o bloco "Destaques do anúncio".

> [!success] Fase 2 — Gerador de post de Instagram ✅ CONCLUÍDA
> Recurso do plano **Pro** (capability `instagramPost`). Imagem 1080×1080 renderizada com `next/og` (`/api/veiculos/[id]/post`), vestida pela identidade da loja, **sem marca da plataforma**. Legenda gerada por IA (`/api/veiculos/[id]/legenda`, reusa `lib/ai.ts`). Slideover no `/admin` com preview, download e legenda editável.

> [!success] Fase 3 — Marketplace AutoStand v1 ✅ CONCLUÍDA
> Portal de busca cross-tenant em `autostand.com.br`: `/comprar` (busca com filtros), `/comprar/[id]` (detalhe + lead), `/lojas` e `/loja/[slug]` (diretório e perfil das concessionárias). Adesão opt-in em `/admin/marketplace`. `lib/marketplace.ts` isola a leitura cross-tenant — só leitura, só campos públicos, só lojas opt-in/ativas. Contato gera lead com `source: marketplace` na conta da loja.

> [!todo] Fase 4 — Feed para portais externos
> A concessionária cadastra o veículo uma vez e ele é publicado nos portais (OLX, Webmotors, iCarros). O mecanismo do mercado é o **feed XML** por loja. **Depende de:** CNPJ + homologação como integradora; camada de normalização marca/modelo → taxonomia do portal. Era o Eixo B do [[Milestone 3]].

> [!todo] Fase 5 — Ranking e publicação automática
> Ranking de lojas no marketplace (exige sistema de avaliações); publicação automática do post no Instagram via Meta Graph API (exige conta Business + *app review* da Meta).

## Relação com os outros milestones

- A **Fase 1** reaproveita e estende o `vehicles` do [[Milestone 1]].
- O **gating** (Fase 2) usa as capabilities do [[Milestone 2]] — ver [[Planos e Preços]].
- A **Fase 4** absorve o antigo Eixo B do [[Milestone 3]] (sindicância em marketplaces).

## Pendências de negócio

- CNPJ — caminho crítico para a Fase 4 (homologação de integradora).
- Definir se o marketplace ganha marca de consumidor própria quando crescer.
