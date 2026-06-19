---
title: Ideias
tags:
  - backlog
  - planejamento
aliases:
  - Backlog
  - Ideias futuras
---

# Ideias

> [!note] O que é esta nota
> Backlog de ideias **ainda não priorizadas** — capturadas para não se perderem. Nada aqui está comprometido com um [[Roadmap|milestone]]. Quando uma ideia amadurece, vira fase de milestone ou entra nas [[Decisões]].

## Marketplace multimarca AutoStand

*Anotada em 2026-05-16 — graduada em 2026-05-18.*

> [!success] Esta ideia amadureceu
> Virou o [[Milestone 4]] (Fase 3 — Marketplace AutoStand v1, concluída). As tensões em aberto foram resolvidas: marketplace **opt-in em todos os planos**, **sem ranking no v1** (ordenação neutra por recência), **marca AutoStand mantida**, e as páginas **afunilam para o site whitelabel** da loja para não canibalizá-lo. Ranking de reputação e feed para portais externos seguem como fases planejadas do M4.

## Gestão completa de fotos do veículo

*Anotada em 2026-05-27.*

> [!success] Baseline implementado (verificado 2026-06-19)
> O `PhotoUploader` evoluiu bastante: excluir em mobile, confirmação por `<Modal>`, reordenação drag-and-drop (coluna `order_idx`), limites de quantidade e tamanho (client + servidor), compressão no client (`browser-image-compression`), `<Lightbox>` e grid responsivo já estão no código. Restam apenas o **progresso por arquivo** (hoje há só loader de lote) e os itens "agradáveis de ter" (rotacionar/crop/caption).

**Estado atual (`components/admin/PhotoUploader.tsx`)**

Já funciona: upload múltiplo, drag-and-drop no dropzone, marcar como principal, excluir (desktop e mobile), reordenar por drag, confirmação antes de excluir, limites de qtd/tamanho, compressão no client, lightbox, grid responsivo, loading state, mensagem de erro.

**Sub-itens prioritários**

- [x] **Excluir no mobile** — ação sempre renderizada (não depende de `group-hover`)
- [x] **Confirmação antes de excluir** — `<Modal>` da Camada 2
- [x] **Reordenar fotos por drag-and-drop** — via `dnd-kit` + `PATCH`; coluna `order_idx` em `vehicle_photos` (`reorderVehiclePhotos`)
- [x] **Limite de quantidade de fotos** — validação no client + servidor (413)
- [x] **Limite de tamanho** — validação client + servidor (`PHOTO_UPLOAD_OPTIONS.maxBytes`)
- [x] **Compressão/resize automático no client** — `browser-image-compression` (`compressIfWorthwhile`)
- [ ] **Indicador de progresso por arquivo** — *parcial:* hoje há loader global de lote ("comprimindo/enviando N fotos…"); falta barra + status por foto
- [x] **Lightbox/preview maior** — `<Lightbox>` em tela cheia
- [x] **Layout responsivo do grid** — `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`

**Sub-itens "agradáveis de ter" (priorizar depois do baseline)**

- [ ] Rotacionar foto (CW/CCW)
- [ ] Crop simples (4:3 já que é a proporção do card)
- [ ] Caption por foto (campo de texto opcional) — requer coluna `caption` em `vehicle_photos`
- [ ] Reorderar via input de posição (alternativa ao drag — útil em A11Y)

## Configurações do storefront pela própria loja (baseline em todos os planos)

*Anotada em 2026-05-27.*

> [!success] Implementado (verificado 2026-06-19)
> Esta frente foi essencialmente entregue: a seção "Sobre" virou CRUD (`tenant_about_items` + `<AboutEditor>`), com 1–6 benefícios (ícone de palette curada + título + descrição). Heading "Por que {loja}?", CTA de contato (título + corpo), redes sociais expandidas (facebook/youtube/tiktok/twitter), dados da loja (endereço/e-mail/horário), upload de logo e de imagem do hero (`<ImageUpload>`) e slogan já estão no painel e no storefront, com validação zod (`lib/validation.ts`) e defaults de fallback. Pendência mínima: os **labels dos botões** do CTA (WhatsApp/Instagram) ainda são fixos.

**Estado atual**

Configurável (`/admin/personalizar`, todos os planos): cores, hero (título/subtítulo/slogan), seção "Sobre" (CRUD), heading, CTA (título/corpo), redes sociais, dados da loja, upload de logo e hero, bancos parceiros. Gated por `layoutConfig` (Pro/Premium): estilo do hero, estilo de card, cards por linha.

**Sub-itens prioritários (baseline pra todos os planos)**

- [x] **CRUD da seção "Sobre"** — 1 a 6 benefícios com ícone (palette Lucide via `ABOUT_ICONS`), título e descrição (`<AboutEditor>`, `lib/db/about.ts`)
- [x] **Heading editável** "Por que {loja}?" — `about_heading`, com fallback para o nome
- [x] **Editar CTA de contato** — título + parágrafo editáveis; *parcial:* os labels dos botões (WhatsApp/Instagram) ainda são fixos no `Storefront.tsx`
- [x] **Redes sociais expandidas** — `facebook_url`, `youtube_url`, `tiktok_url`, `twitter_url` no schema, no editor e no `StorefrontFooter`
- [x] **Editar dados de loja** — `address`, `contact_email`, `business_hours` no editor
- [x] **Upload de logo** (não só URL) — `<ImageUpload kind="logo">`
- [x] **Upload de imagem do hero** (não só URL) — `<ImageUpload kind="hero">`
- [x] **Slogan/tagline curto** — coluna `slogan`, no editor e no `StorefrontHero`

**Re-tiering de capabilities (proposta)**

- `customColors`, `customTexts` (novo — todos os campos acima), `socialLinks` (novo) e `customAbout` (novo) → **Básico+**
- `layoutConfig` (estilos visuais) → Pro+
- `customDomain` → Premium
- `instagramPost`, `aiAnalysis`, `marketInsights` → Premium

**Tarefas técnicas que abrem essa frente**

- [x] Schema: novos campos em `tenants` (`slogan`, `contact_cta_title`, `contact_cta_body`, redes sociais), tabela `tenant_about_items` (id, tenant_id, position, icon_slug, title, description) com cascade
- [x] Endpoint `PATCH /api/personalizar` aceita os novos campos (allowlist via `tenantStorefrontSchema`)
- [x] Componente `<AboutEditor>` no painel: lista ordenável de cards, modal de edição, palette de ícones
- [x] Storefront `<Storefront>` consome `about_items` (`listAboutItems`) em vez de hardcoded
- [x] Defaults inteligentes: fallback para os benefícios padrão quando a loja não configurou (`defaultAboutCards`)
- [x] Validação zod nos campos novos, limite de chars, allowlist de `icon_slug` (`z.enum(ABOUT_ICONS)`)
