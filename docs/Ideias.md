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

> [!abstract] Resumo
> O `PhotoUploader` atual entrega o básico (upload múltiplo, drag-and-drop, marcar principal, excluir), mas falta polimento em mobile, reordenação, validação de tamanho/qtd e feedback granular. A excluir-no-hover não funciona em touch — bug real. Esta ideia agrupa o que falta pra "subir foto de carro" ser uma experiência confiável.

**Estado atual (`components/admin/PhotoUploader.tsx`)**

Já funciona: upload múltiplo, drag-and-drop no dropzone, marcar como principal, excluir (no desktop), loading state global, mensagem de erro, `accept="image/*"` no input.

**Sub-itens prioritários**

- [ ] **Excluir no mobile** — botões hoje vivem em `group-hover` (não dispara em touch); ou trocar pra long-press / botão sempre visível em mobile, ou adicionar um overlay tap-to-reveal
- [ ] **Confirmação antes de excluir** — usar `<Modal>` da Camada 2; hoje clica e some
- [ ] **Reordenar fotos por drag-and-drop** entre cards (define a ordem de exibição no site público); requer coluna `position` no schema `vehicle_photos`
- [ ] **Limite de quantidade de fotos** (ex.: 15 por veículo) — validação no client + servidor
- [ ] **Limite de tamanho** (ex.: 8MB por foto) — validação client; alinha com Onda 5 de segurança que adiciona a validação no servidor
- [ ] **Compressão/resize automático no client** (canvas API ou `browser-image-compression`) — corta upload de 12MB→1MB e melhora performance do storefront
- [ ] **Indicador de progresso por arquivo** — hoje um loader único pra todo o lote; idealmente barra por foto + status (pendente / enviando X% / erro / ok)
- [ ] **Lightbox/preview maior** — clicar abre em `<Modal>` size=xl
- [ ] **Layout responsivo do grid** — `grid-cols-3` em mobile espreme demais; deveria ser 2 colunas até `md:`

**Sub-itens "agradáveis de ter" (priorizar depois do baseline)**

- [ ] Rotacionar foto (CW/CCW)
- [ ] Crop simples (4:3 já que é a proporção do card)
- [ ] Caption por foto (campo de texto opcional)
- [ ] Reorderar via input de posição (alternativa ao drag — útil em A11Y)

## Configurações do storefront pela própria loja (baseline em todos os planos)

*Anotada em 2026-05-27.*

> [!abstract] Resumo
> Hoje várias seções do site da loja são hardcoded (a seção "Sobre" tem 4 benefícios fixos, o CTA de contato tem título fixo). A loja consegue trocar cor e título do hero — só isso no plano Básico. Esta ideia leva a personalização de **texto e estrutura editorial** pra todos os planos, mantendo `layoutConfig`/`customDomain`/`aiAnalysis` como gates premium.

**Estado atual**

Configurável (`/admin/personalizar`, todos os planos):
- Cor principal, cor de destaque, destaque escuro
- Título e subtítulo do hero (campos texto)
- Bancos parceiros (logos no rodapé e na página do veículo)

Configurável só nos planos com `layoutConfig` (Pro/Premium):
- Estilo do hero (gradient/solid/image)
- URL de imagem do hero
- Estilo de card (5 variantes)
- Cards por linha (3 ou 4)

Hardcoded em `components/public/Storefront.tsx` (qualquer loja, qualquer plano):
- Seção "Sobre" — 4 benefícios fixos (Procedência, Sem taxa, Financiamento, Atendimento)
- Heading "Por que {nome da loja}?"
- Seção contato — "Pronto para comprar?" + parágrafo "Entre em contato agora..."

**Sub-itens prioritários (baseline pra todos os planos)**

- [ ] **CRUD da seção "Sobre"** — 1 a 6 benefícios editáveis, cada um com (a) ícone selecionado de uma palette curada de Lucide (ShieldCheck/Handshake/CreditCard/MessageCircle/Wrench/Award/Truck/Clock/PhoneCall...), (b) título, (c) descrição curta
- [ ] **Heading editável** "Por que {loja}?" — campo de texto, com fallback para o nome
- [ ] **Editar CTA de contato** — título + parágrafo de copy + label dos botões
- [ ] **Redes sociais expandidas** — schema hoje só tem `instagram_url`; adicionar `facebook_url`, `youtube_url`, `tiktok_url`, `twitter_url`, exibir como pílulas no footer
- [ ] **Editar dados de loja** — `address`, `contact_email`, `business_hours` num único formulário organizado (algumas colunas já existem no schema, faltam UI)
- [ ] **Upload de logo** (não só URL) — usar mesma infra do PhotoUploader, com regras de tamanho/aspect-ratio
- [ ] **Upload de imagem do hero** (hoje só URL) — mesma infra
- [ ] **Slogan/tagline curto** — campo de 1 linha pro topo do hero (acima do título)

**Re-tiering de capabilities (proposta)**

- `customColors`, `customTexts` (novo — todos os campos acima), `socialLinks` (novo) e `customAbout` (novo) → **Básico+**
- `layoutConfig` (estilos visuais) → Pro+
- `customDomain` → Premium
- `instagramPost`, `aiAnalysis`, `marketInsights` → Premium

**Tarefas técnicas que abrem essa frente**

- [ ] Schema: novos campos em `tenants` (`slogan`, `contact_cta_title`, `contact_cta_body`, `facebook_url`, `youtube_url`, `tiktok_url`, `twitter_url`), nova tabela `tenant_about_items` (id, tenant_id, position, icon_slug, title, description) com cascade
- [ ] Endpoint `PATCH /api/personalizar` aceita os novos campos (com allowlist atualizada)
- [ ] Componente `<AboutEditor>` no painel: lista ordenável de cards, modal de edição, palette de ícones
- [ ] Storefront `<Storefront>` consome `tenant.about_items` em vez de hardcoded
- [ ] Defaults inteligentes: se loja não configurou nenhum benefício, mostra os 4 atuais como fallback (mantém compatibilidade)
- [ ] (Onda 5/sec) validação zod nos campos novos, limite de chars, allowlist de icon_slug
