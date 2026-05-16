---
title: Design System
tags:
  - tecnico
  - frontend
  - marca
aliases:
  - Tokens
  - Tema
  - Padrões de Frontend
---

# Design System

> [!abstract] Resumo
> Os padrões de frontend da plataforma: tokens de cor e tipografia, como o tema é aplicado e a fronteira entre a marca **AutoStand** e o **whitelabel** de tenant. Fonte da verdade visual: o **Manual da Marca V1.2** (PDF) — esta nota é a tradução dele para o código.

## ⚠️ Dois temas, nunca confundir

O sistema tem **dois conjuntos de variáveis de tema** que vivem lado a lado. Trocar um pelo outro é o erro mais fácil de cometer.

| | Tema da plataforma | Tema do tenant (whitelabel) |
|---|---|---|
| **Variáveis** | `--color-*`, `--font-*`, `--text-*` | `--brand-primary`, `--brand-accent`, … |
| **Definido em** | `app/globals.css` (`@theme`) | `app/(public)/layout.tsx` (inline, runtime) |
| **Origem do valor** | fixo — Manual da Marca | banco — colunas de cor do `TenantRow` |
| **Veste** | Painel da Loja (`/admin`), Console super-admin (`/superadmin`), `autostand.com.br` | o **site público** de cada concessionária |
| **Governado por** | Manual da Marca AutoStand | identidade do próprio cliente |

> [!danger] Regra
> No **site público** (`app/(public)/...`) use **apenas** `--brand-*`. Nas **superfícies da plataforma** (`/admin`, `/superadmin`) use **apenas** os tokens `--color-*`. A marca AutoStand nunca aparece no site do cliente além de um discreto "Tecnologia AutoStand" no rodapé. Ver [[Arquitetura#Branding dinâmico]] e [[Decisões]].

## Tokens de cor

Definidos em `app/globals.css`. O Tailwind v4 gera utilitárias a partir deles (`bg-ink`, `text-signal`, `border-n200`, …) e também expõe cada um como `var(--color-*)`.

### Primária

| Token | Hex | Uso |
|---|---|---|
| `--color-ink` | `#0B1F33` | Institucional, texto primário, fundos escuros |
| `--color-ink-800` | `#15324D` | Superfície escura elevada (dark mode) |
| `--color-signal` | `#FF6A1A` | Ação, CTAs, dados-destaque — **máx. 15% da tela** |
| `--color-signal-dark` | `#D9521A` | Estado `hover`/`pressed` do laranja |
| `--color-sand` | `#F5F1EA` | Fundo quente; substitui o branco puro |

### Neutros de interface

Rampa única, convenção **número maior = mais escuro**.

| Token | Hex | Uso |
|---|---|---|
| `--color-n50` | `#F6F7F8` | Fundo de app |
| `--color-n100` | `#EAEDEF` | Superfícies, cards |
| `--color-n200` | `#D5DADF` | Bordas, divisores |
| `--color-n400` | `#94A0AB` | Texto desabilitado, ícones leves |
| `--color-n600` | `#6B7A88` | Texto secundário |
| `--color-n900` | `#0B1F33` | Texto primário (alias de `--color-ink`) |

### Sistema (feedback)

Só no produto, para estados — **nunca** em peça de marca.

| Token | Hex | Uso |
|---|---|---|
| `--color-success` | `#2BB673` | Sucesso, venda concluída |
| `--color-warning` | `#F2B600` | Atenção, pendência |
| `--color-danger` | `#C8102E` | Erro, ação destrutiva |

> [!warning] Acessibilidade — contraste é obrigatório (WCAG AA)
> - Texto sobre `signal` (laranja) ou `warning` (amarelo): **sempre** `ink`, **nunca** branco. Branco sobre laranja dá ~2,9:1 e reprova.
> - Botão laranja ⇒ label em `ink` (`bg-signal text-ink`).
> - Laranja **como texto** só sobre fundo escuro (`ink` / `ink-800`).
> - `success` e `warning` são **claros demais para servir de texto**. Use-os como fundo tonal (`bg-success/12`), anel, ponto ou ícone — com o texto em `ink`. `danger` (vermelho escuro) pode ser texto.

## Tokens de tipografia

Duas famílias: **Sora** (títulos, números, impacto) e **Inter** (corpo, UI, microcopy). Ambas Google Fonts (licença SIL OFL), carregadas via `@import` no `globals.css`.

| Token | Tamanho / LH | Família · peso | Uso |
|---|---|---|---|
| `text-display` | 56px / 1.05 | Sora 700 | Headline de capa |
| `text-h1` | 40px / 1.10 | Sora 600 | Título de página |
| `text-h2` | 30px / 1.15 | Sora 600 | Seções principais |
| `text-h3` | 22px / 1.25 | Sora 600 | Subseções, cards |
| `text-body-l` | 18px / 1.55 | Inter 400 | Parágrafo de destaque, lead |
| `text-body` | 16px / 1.55 | Inter 400 | Corpo padrão |
| `text-body-s` | 14px / 1.50 | Inter 400 | Auxiliar, legendas, helper text |
| `text-eyebrow` | 12px / 1.40 | Inter 600 | Sobretítulo — usar com `uppercase` |

Cada `text-*` já carrega `line-height` e `letter-spacing`. Famílias: utilitárias `font-display` (Sora) e `font-body` (Inter).

> [!note] `font-heading` é legado
> O token `--font-heading` (Syncopate) **não** faz parte da marca AutoStand. Ele veste só o site público (storefront), que é whitelabel. Não use em superfícies da plataforma.

## Como usar

```tsx
// Superfície de plataforma (/admin, /superadmin)
<section className="bg-n50 text-ink">
  <p className="text-eyebrow uppercase text-signal">Painel da Loja</p>
  <h1 className="font-display text-h1">Margem real por veículo</h1>
  <p className="font-body text-body text-n600">Texto secundário.</p>
  <button className="bg-signal text-ink hover:bg-signal-dark">Ver detalhes</button>
</section>
```

```css
/* Em CSS custom, os tokens também existem como variáveis */
.card { background: var(--color-n100); border: 1px solid var(--color-n200); }
```

## Assets da marca

Símbolo e ícones versionados em `docs/brand/`:

| Arquivo | Uso |
|---|---|
| `autostand-symbol.svg` | Símbolo sobre fundo claro |
| `autostand-symbol-negative.svg` | Símbolo sobre fundo escuro |
| `autostand-app-icon.svg` | Ícone de app / favicon (mestre) |
| `icons/icon-{16,32,180,192,512}.png` | Favicon, `apple-touch-icon`, PWA |

Ao ligar no Next.js: `app/icon.png` (favicon), `app/apple-icon.png` — o App Router resolve pela convenção de nomes.

## Estado atual

> [!success] Painel migrado
> `/admin` e `/superadmin` (26 arquivos) usam os tokens da marca — sem cores Tailwind genéricas. Famílias antigas mapeadas: `slate-*` → rampa `n*`; `blue-*`/`indigo-*` → `signal`; `emerald`/`amber`/`red` → `success`/`warning`/`danger`. Código novo de plataforma deve nascer usando os tokens.

> [!note] Storefront público é à parte
> O site público (`app/(public)/...`) **não** foi tocado — é whitelabel e segue com `--brand-*` + `font-heading` (Syncopate). Isso é proposital.

## Relacionado

- [[Arquitetura]] — branding dinâmico e resolução de tenant.
- [[Desenvolvimento]] — setup e convenções de código.
- [[Decisões]] — por que whitelabel e por que niche em concessionárias.
