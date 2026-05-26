# SPEC do Design System — AutoStand

**Versão:** 1.0 · **Data:** 2026-05-26 · **Status:** Plano aprovado, tokens implementados, componentes pendentes
**Fonte da verdade visual:** Manual da Marca V1.2 (PDF) + este documento

> Este SPEC traduz o Manual da Marca em um sistema de design técnico e operacional. O objetivo é levar a plataforma de "boa, mas inconsistente" para **editorial premium** — warmth do `sand`/`ink`, foto e tipografia em primeiro plano, laranja como ferramenta cirúrgica (não decorativa), e storefronts da loja com guardrails fortes (cliente escolhe a cor da sua marca; tudo o mais vem do sistema).

---

## 1. Princípios

O design system gira em torno de 6 princípios. Quando duas decisões competem, vence o princípio mais alto.

### 1.1 Editorial antes de SaaS
Tipografia grande e respirada, fotos como protagonistas, hierarquia clara. Páginas devem parecer um suplemento automotivo de jornal premium, não um dashboard Bootstrap.

> **Implicação:** título de página é Sora 600 em 40-56px. Cards têm imagem dominante. Texto secundário em peso 400, nunca caps.

### 1.2 Calor controlado
A paleta usa `sand` (creme), `ink` (azul-marinho profundo) e neutros temperados (não cinza puro). Branco puro só em superfícies de leitura intensa. Nada de fundo `#FFFFFF` chapado em tela cheia.

> **Implicação:** `bg-sand` para superfícies premium, `bg-n50` para canvas, `bg-white` apenas para cards/superfícies elevadas em contraste com `bg-n50`.

### 1.3 Laranja é cirúrgico, não decorativo
`signal` (#FF6A1A) reservado para:
- **CTAs primários** (ação principal da tela)
- **Dados-destaque** (KPI principal, métrica que define a tela)
- **Estado ativo** de navegação primária

Nunca em: badges genéricos, ícones decorativos, anéis de foco, "ver mais →", borda de hover. Para destaque secundário use `ink` em chapado.

> **Regra do 15%:** se laranja ocupa visualmente mais de 15% da peça, está errado. Auditoria simples — printscreen, blur 40px: o que sobrar laranja deve ser CTA.

### 1.4 Hierarquia por tamanho, não por cor
Em vez de "este texto é importante então fica laranja", aumentamos o tamanho ou o peso. Cor entra só pra **estado** (CTA, sucesso, erro), não pra ênfase.

> **Implicação:** títulos sempre `text-ink` (preto-azulado), nunca laranja. Subtítulos em `text-n600`. Métricas em fonte grande, não em cor.

### 1.5 Espaço é luxo
Padding generoso em cards (32-40px), gap maior entre seções (64-96px), margens internas amplas. Densidade só onde a função pede (tabelas, listas de dados).

> **Implicação:** sections com `py-16` (64px) ou `py-24` (96px); cards com `p-8` (32px); evitar `p-4` em superfícies de destaque.

### 1.6 Motion é convicção, não acessório
Toda interação muda de estado com transição perceptível: hover em 150ms (cubic-bezier suave), pressed em 100ms, page transitions em 200-300ms. Sem bouncy/elastic em produto. Skeletons em vez de spinners.

> **Implicação:** todo componente interativo tem `transition-*` declarado. Loading states são skeleton, não spinner. Empty states têm ilustração + ação.

---

## 2. Tokens

### 2.1 Cor

#### 2.1.1 Primária da marca

| Token | Hex | Uso canônico |
|---|---|---|
| `--color-ink` | `#0B1F33` | Texto primário, fundos escuros, anchor visual |
| `--color-ink-700` | `#1E3A55` | Hover de superfície escura |
| `--color-ink-800` | `#15324D` | Superfície escura elevada (dark mode futuro) |
| `--color-ink-900` | `#061629` | Superfície escura profunda (modal, command palette) |
| `--color-signal` | `#FF6A1A` | CTA primário, dado-destaque, nav ativo |
| `--color-signal-dark` | `#D9521A` | Hover/pressed do laranja |
| `--color-signal-soft` | `#FFF1E8` | Background tonal de destaque (uso muito limitado) |
| `--color-sand` | `#F5F1EA` | Fundo quente, superfície premium |
| `--color-sand-dark` | `#EBE5DA` | Hover sobre `sand`, borda quente |

#### 2.1.2 Rampa neutra (preenche os gaps do sistema atual)

Convenção: **número maior = mais escuro**. Rampa completa em 10 passos.

| Token | Hex | Uso canônico |
|---|---|---|
| `--color-n50` | `#F6F7F8` | Canvas, fundo de app |
| `--color-n100` | `#EAEDEF` | Superfícies sutis, cards em `bg-n50` |
| `--color-n150` | `#E0E4E8` | Hover de `n100`, divisor suave |
| `--color-n200` | `#D5DADF` | Bordas, divisores |
| `--color-n300` | `#BFC6CD` | Borda forte, divisor de seção (**preenche o bug do `border-n300`**) |
| `--color-n400` | `#94A0AB` | Ícones leves, texto desabilitado |
| `--color-n500` | `#7C8895` | Texto muted (não desabilitado) |
| `--color-n600` | `#6B7A88` | Texto secundário (padrão) |
| `--color-n700` | `#4F5D6B` | Texto secundário forte |
| `--color-n800` | `#33414F` | Texto quase-primário sobre fundo claro |
| `--color-n900` | `#0B1F33` | Alias de `--color-ink` |

#### 2.1.3 Sistema (feedback)

Só em estados de produto. Nunca em peça de marca.

| Token | Hex | Uso |
|---|---|---|
| `--color-success` | `#2BB673` | Sucesso, venda concluída — sempre como fundo tonal (`bg-success/12`) ou ícone, **nunca como texto** |
| `--color-success-dark` | `#1F8C57` | Hover do success, texto sobre fundo claro |
| `--color-warning` | `#F2B600` | Atenção, pendência — **nunca como texto**; fundo `bg-warning/15` |
| `--color-warning-dark` | `#B8860B` | Texto warning sobre fundo claro |
| `--color-danger` | `#C8102E` | Erro, ação destrutiva — pode ser texto |
| `--color-danger-soft` | `#FDECEE` | Fundo tonal de erro |

#### 2.1.4 Regras de contraste (WCAG AA, obrigatório)

| Combinação | Resultado | Permitido? |
|---|---|---|
| `text-white` sobre `bg-signal` | 2.9:1 | ❌ Nunca |
| `text-ink` sobre `bg-signal` | 5.8:1 | ✅ Padrão para CTA |
| `text-white` sobre `bg-ink` | 14.2:1 | ✅ |
| `text-signal` sobre `bg-white` | 3.4:1 | ❌ Só em ícone ≥24px ou texto ≥24px Bold |
| `text-signal` sobre `bg-ink` | 4.9:1 | ✅ Apenas para títulos ≥24px |
| `text-success` sobre `bg-white` | 2.8:1 | ❌ Use `text-success-dark` |
| `text-n400` sobre `bg-white` | 3.0:1 | ❌ Não é texto, é ícone/disabled |
| `text-n600` sobre `bg-white` | 4.6:1 | ✅ Texto secundário |

#### 2.1.5 Tokens de tenant (whitelabel, **runtime**)

Setados em `app/(public)/layout.tsx` a partir do banco. **Só** vivem no storefront da loja:

```css
--brand-primary       /* cor primária da loja — equivalente do signal */
--brand-primary-dark  /* hover/pressed da primary */
--brand-accent        /* opcional, segunda cor */
--brand-ink           /* texto primário no tema da loja (fallback: --color-ink) */
--brand-surface       /* fundo de seção (fallback: --color-sand) */
```

**Guardrails do whitelabel** (ver §6).

### 2.2 Tipografia

#### 2.2.1 Famílias

| Token | Família | Quando |
|---|---|---|
| `--font-display` | Sora 400/600/700 | Títulos, números grandes, KPIs |
| `--font-body` | Inter 300/400/500/600/700 | Corpo, UI, microcopy |
| ~~`--font-heading`~~ | ~~Syncopate~~ | **DEPRECATED** — só legado de storefront antigo; remover na próxima refatoração |

#### 2.2.2 Escala (já existe — mantida)

| Token | Tamanho | LH | LS | Peso padrão | Uso |
|---|---|---|---|---|---|
| `text-display` | 56px | 1.05 | -0.03em | Sora 700 | Headline de capa, hero |
| `text-h1` | 40px | 1.10 | -0.02em | Sora 600 | Título de página |
| `text-h2` | 30px | 1.15 | -0.01em | Sora 600 | Seções principais |
| `text-h3` | 22px | 1.25 | -0.01em | Sora 600 | Subseções, títulos de card |
| `text-body-l` | 18px | 1.55 | 0 | Inter 400 | Lead, parágrafo de destaque |
| `text-body` | 16px | 1.55 | 0 | Inter 400 | Corpo padrão |
| `text-body-s` | 14px | 1.50 | 0 | Inter 400 | Helper, legenda, metadado |
| `text-eyebrow` | 12px | 1.40 | 0.22em | Inter 600 | Sobretítulo (sempre uppercase) |

#### 2.2.3 Hierarquia (regras práticas)

- **Uma página, um `text-display` OU `text-h1`** (jamais os dois). Display é só hero de marketing.
- **`text-h2` é a granularidade mais comum** — usar pra cada seção.
- **`text-eyebrow` antes de `text-h1`/`text-h2`** quando precisar contextualizar ("Para concessionárias", "Marketplace", "Painel").
- **Microcopy em `text-body-s` + `text-n600`**. Helper text de input em `text-body-s` + `text-n500`.

### 2.3 Spacing

Tailwind v4 já entrega `--spacing` em incrementos de 0.25rem. Convenção do AutoStand:

| Token | px | Onde |
|---|---|---|
| `space-1` | 4 | Gap entre ícone e texto |
| `space-2` | 8 | Padding interno de chip/tag |
| `space-3` | 12 | Gap em formulário denso |
| `space-4` | 16 | Padding de input |
| `space-6` | 24 | Padding de card pequeno |
| `space-8` | 32 | Padding de card padrão, gap entre cards |
| `space-12` | 48 | Padding de seção em mobile |
| `space-16` | 64 | Padding de seção desktop |
| `space-24` | 96 | Gap entre seções de hero/marketing |
| `space-32` | 128 | Margem topo/fundo de hero |

**Regras:**
- Cards de produto têm `p-8` (32px) — não `p-4`.
- Sections de landing têm `py-16 lg:py-24`.
- Forms têm gap entre fields em `space-y-6` (24px); legenda 4px abaixo do input.
- Em mobile reduzir um passo na escala (24→16, 64→48, 96→64).

### 2.4 Border radius

| Token | px | Uso |
|---|---|---|
| `--radius-xs` | 4 | Chips, tags, badges |
| `--radius-sm` | 6 | Botões pequenos, inputs |
| `--radius-md` | 8 | Botões padrão, dropdowns |
| `--radius-lg` | 12 | Inputs grandes, cards de listagem |
| `--radius-xl` | 16 | Cards de destaque, modais |
| `--radius-2xl` | 24 | Hero cards, painéis premium |
| `--radius-full` | 9999 | Avatares, pílulas |

**Regra:** dentro de um card de `radius-xl`, elementos internos usam `radius-md` ou menos (regra do "filho menor que o pai" para evitar parecer balão).

### 2.5 Shadow & elevação

Sombras sutis, longa e baixa-opacidade — não dark-mode-de-Material-Design.

| Token | Valor | Uso |
|---|---|---|
| `--shadow-xs` | `0 1px 2px rgba(11, 31, 51, 0.04)` | Borda elevada (alternativa a `border`) |
| `--shadow-sm` | `0 2px 8px rgba(11, 31, 51, 0.06)` | Card em repouso |
| `--shadow-md` | `0 8px 24px rgba(11, 31, 51, 0.08)` | Card em hover |
| `--shadow-lg` | `0 16px 48px rgba(11, 31, 51, 0.12)` | Dropdown, popover |
| `--shadow-xl` | `0 24px 64px rgba(11, 31, 51, 0.16)` | Modal, command palette |
| `--shadow-inset` | `inset 0 1px 0 rgba(255, 255, 255, 0.06)` | Highlight interno em superfícies escuras |

**Regra:** card em repouso usa `shadow-xs` + `border-n200`. Em hover transiciona para `shadow-md` + `border-transparent`.

### 2.6 Motion

| Token | Valor | Uso |
|---|---|---|
| `--duration-instant` | 80ms | Press, toggle |
| `--duration-fast` | 150ms | Hover, focus, color change |
| `--duration-normal` | 240ms | Open/close de dropdown, accordion |
| `--duration-slow` | 360ms | Modal, drawer, page section |
| `--duration-slower` | 600ms | Hero parallax, intro de página |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Padrão de entrada |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Toggle, ida-e-volta |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Drop com pequeno overshoot — usar com parcimônia |

**Regras:**
- Hover em 150ms, sempre `--ease-out`.
- Loading state: skeleton com shimmer em 1.5s loop, `--ease-in-out`.
- Nada de bouncy/elastic em formulários ou botões — só em elementos celebratórios (confete de venda concluída, p.ex.).
- `prefers-reduced-motion: reduce` desliga tudo acima de 100ms.

### 2.7 Z-index

| Token | Valor | Camada |
|---|---|---|
| `--z-base` | 0 | Documento |
| `--z-raised` | 10 | Card elevado, sticky header de seção |
| `--z-dropdown` | 100 | Dropdown, popover |
| `--z-sticky` | 200 | Sticky nav |
| `--z-overlay` | 300 | Backdrop de modal |
| `--z-modal` | 400 | Modal, drawer |
| `--z-toast` | 500 | Toast, snackbar |
| `--z-tooltip` | 600 | Tooltip |
| `--z-max` | 9999 | Command palette, debug overlay |

### 2.8 Breakpoints (já default do Tailwind, documentado)

| Token | Min-width | Uso |
|---|---|---|
| `sm` | 640px | Tablet pequeno |
| `md` | 768px | Tablet |
| `lg` | 1024px | Laptop, divisor mobile→desktop principal |
| `xl` | 1280px | Desktop |
| `2xl` | 1536px | Desktop largo |

**Regra:** desenhar **mobile-first**; `lg:` é o breakpoint que divide as duas mentalidades (mobile-card vs desktop-table, sidebar fechada vs aberta, etc.).

---

## 3. Hierarquia de cor em ação

Como aplicar os tokens corretamente em cada situação:

### 3.1 Surface stack (do mais escuro pro mais claro)

```
                            ┌─ z-modal       text-white     bg-ink-900
                          ┌─┘
                        ┌─┘
                      ┌─┘      bg-ink         (sidebar escura)
        bg-white  ────┐
                       └─ bg-sand            (hero, premium)
                          bg-n100            (card sobre n50)
                          bg-n50             (canvas)
```

### 3.2 Quando usar qual fundo

| Superfície | Background | Texto primário | Texto secundário | Borda |
|---|---|---|---|---|
| Canvas (página) | `bg-n50` | `text-ink` | `text-n600` | — |
| Card padrão | `bg-white` | `text-ink` | `text-n600` | `border-n200` |
| Card destaque | `bg-sand` | `text-ink` | `text-n700` | `border-sand-dark` |
| Hero marketing | `bg-ink` | `text-white` | `text-n300` | — |
| Sidebar admin | `bg-white` ou `bg-n50` | `text-ink` | `text-n600` | `border-r border-n200` |
| Sidebar superadmin | `bg-ink` | `text-white` | `text-n400` | — |
| Modal | `bg-white` | `text-ink` | `text-n600` | `border-n200` + `shadow-xl` |
| Toast sucesso | `bg-white` + `border-l-4 border-success` | `text-ink` | `text-n600` | — |

### 3.3 Botões — taxonomia

| Variante | Quando | Estilo |
|---|---|---|
| **Primary** | Ação principal da tela (1 por tela) | `bg-signal text-ink` + hover `bg-signal-dark` |
| **Secondary** | Ação secundária comum | `bg-ink text-white` + hover `bg-ink-700` |
| **Outline** | Ação alternativa, peso médio | `border border-n300 text-ink bg-transparent` + hover `bg-n50` |
| **Ghost** | Ação inline, baixo peso | `text-ink bg-transparent` + hover `bg-n100` |
| **Danger** | Ação destrutiva | `bg-danger text-white` + hover `bg-danger-dark` |
| **Link** | Navegação inline | `text-ink underline underline-offset-4` |

**Anti-padrão:** botão laranja secundário ("voltar", "cancelar"). Laranja é sempre **a ação positiva principal**.

### 3.4 Badges & status

Padrão sempre: `bg-{cor}/12` + `text-{cor}-dark` + `border-{cor}/30`. **Nunca** texto branco sobre cor sólida.

| Status | Estilo |
|---|---|
| Disponível | `bg-success/12 text-success-dark ring-1 ring-success/30` |
| Pendente | `bg-warning/15 text-warning-dark ring-1 ring-warning/30` |
| Vendido | `bg-n200 text-n700 ring-1 ring-n300` |
| Suspenso | `bg-danger-soft text-danger ring-1 ring-danger/30` |
| Destaque | `bg-signal/12 text-ink ring-1 ring-signal/30` |

---

## 4. Padrões de UX

### 4.1 Estados de interação (obrigatórios em todo componente interativo)

| Estado | Trigger | Visual |
|---|---|---|
| Default | repouso | Estilo base |
| Hover | mouseover (não toque) | Mudança sutil de background OU `shadow-sm → shadow-md` |
| Focus | tab/click | Anel `ring-2 ring-ink/30 ring-offset-2` ou `ring-2 ring-signal/40` em CTA |
| Pressed | mousedown | `scale-[0.98]` + sombra reduzida |
| Disabled | prop | `opacity-50 cursor-not-allowed` |
| Loading | promise pendente | Spinner inline + texto "Carregando..." OU skeleton se for layout |

### 4.2 Loading states — sempre skeleton, raramente spinner

| Situação | Padrão |
|---|---|
| Listagem (cards, tabela) | Skeleton com shape igual ao item final |
| Detalhe (página inteira) | Skeleton da estrutura |
| Botão em ação | Spinner inline + texto adaptado ("Salvando...") |
| Inline (chip, autocomplete) | Spinner pequeno (16px) |

**Anti-padrão:** spinner gigante centralizado em tela vazia.

### 4.3 Empty states — sempre 3 elementos

1. **Ilustração ou ícone grande** (não emoji; SVG de Lucide ou ilustração custom).
2. **Mensagem** em duas linhas: 1ª linha clara do que está vazio, 2ª linha por quê / o que fazer.
3. **CTA** primário pra resolver o vazio ("Cadastre o primeiro veículo", "Convide um vendedor").

### 4.4 Error states

| Tipo | Padrão |
|---|---|
| Inline (campo de form) | Borda `border-danger`, texto `text-danger text-body-s` abaixo |
| Toast | Card branco + barra lateral `border-l-4 border-danger` + ícone + mensagem |
| Tela inteira | Página de erro com ilustração, mensagem, botão "Tentar novamente" e link "Voltar" |
| 404 | Página dedicada com ilustração e busca/links |

### 4.5 Densidade — duas tabelas, dois ritmos

| Contexto | Linha | Padding célula | Tipografia |
|---|---|---|---|
| Lista densa (financeiro, leads) | 48px | py-3 px-4 | `text-body-s` |
| Lista de produto (veículos com foto) | 88px | py-5 px-5 | `text-body` |

### 4.6 Mobile rules (≤lg)

- Tabelas viram cards verticais.
- Sidebar vira drawer ou bottom nav.
- Hero diminui display 56→40px.
- Touch target mínimo 44px (já implementado em commit recente).
- Forms 1 coluna, gap `space-y-5`.

---

## 5. Componentes — biblioteca mínima viável

Lista priorizada do que sistematizar. Cada item terá API e variants documentadas em uma 2ª onda; aqui ficam os requisitos.

### 5.1 Camada 1 — fundação (refatorar primeiro)

| Componente | Estado | Notas |
|---|---|---|
| `Button` | existe ad-hoc | 5 variants (primary/secondary/outline/ghost/danger), 3 sizes (sm/md/lg), suporte a icon-only, loading state |
| `Card` | existe ad-hoc | Variants: `surface` (bg-white), `elevated` (sand), `interactive` (hover) |
| `Input` | existe | Adicionar variants `default/error/disabled`, helper text, label flutuante opcional |
| `Select` (combobox) | **falta** | Substitui `<select>` nativo no marketplace; usa Radix UI |
| `Badge` | inline | Padronizar pelas regras de §3.4 |
| `Avatar` | falta | Quadrado com `radius-md` para loja; redondo para usuário |
| `Skeleton` | **falta** | Variants: text, circle, rect, custom |

### 5.2 Camada 2 — composição

| Componente | Notas |
|---|---|
| `Modal` / `Dialog` | Radix; padrão de header/body/footer; `shadow-xl` + `radius-xl` |
| `Drawer` (mobile) | Slide-from-right; usado pra filtros do marketplace |
| `Toast` | sonner ou Radix; durações: 4s padrão, 8s para ações importantes |
| `Tabs` | Hover state, transição suave, indicador animado |
| `Tooltip` | Radix; delay 300ms; só pra info adicional, nunca obrigatória |
| `Dropdown` | Radix; consistência com `Select` |
| `Tag` (filtro ativo, optional, etc.) | Removível com X |
| `EmptyState` | wrapper que enforça §4.3 |
| `Pagination` | numérica + cursor |

### 5.3 Camada 3 — domínio AutoStand

| Componente | Notas |
|---|---|
| `VehicleCard` (marketplace) | Foto 4:3, marca eyebrow, modelo h3, versão small, KPIs em pílulas, preço destacado, logo da loja, hover de elevação |
| `VehicleCard` (storefront) | Igual mas usa `--brand-*` |
| `LeadKanbanCard` | Drag handle, badges de origem, indicador de tempo |
| `KPITile` | Eyebrow + número grande + delta com seta + sparkline opcional |
| `MoneyDisplay` | Formato BR (R$), variants `default/positive/negative` |
| `StatusBadge` | Variants pra venda/lead/transação |
| `BrandThemeProvider` | Aplica `--brand-*` no storefront |

---

## 6. Storefront whitelabel — guardrails

Decisão: **loja escolhe brand colors, tudo o mais vem do AutoStand**. O storefront não pode parecer "outro produto" — só uma roupagem.

### 6.1 O que a loja controla

- `--brand-primary` (cor primária — papel de `signal` no storefront)
- `--brand-primary-dark` (hover/pressed)
- `--brand-accent` (opcional, segunda cor)
- Logo (PNG/SVG)
- Nome da loja, slogan, horário, WhatsApp, endereço
- Foto de capa do hero (opcional)
- Layout (1-2 variantes pré-aprovadas, não freeform)

### 6.2 O que o AutoStand controla (não-negociável)

- **Toda a tipografia** (Sora + Inter, mesmo scale `text-display`/`text-h1`/etc.) — sem Syncopate, sem Comic Sans
- **Spacing scale** (mesmo system)
- **Radius scale** (mesmo system)
- **Shadows** (mesmo system)
- **Motion** (mesmo system)
- **Componentes de UI** (Button, Card, Input, Modal, etc.)
- **Estrutura de página** (hero, filtros, listagem, detalhe)
- **Rampa neutra** (`n50` a `n900`)
- **Sistema de feedback** (`success`/`warning`/`danger`)
- **Iconografia** (Lucide, peso 1.5, tamanho 16/20/24)

### 6.3 Validações automáticas (a fazer)

- Contraste `--brand-primary` × branco: ≥ 4.5:1 (alerta no admin se loja escolhe primária clara)
- Logo: dimensões mínimas, fundo transparente, peso ≤ 200KB
- Banner hero: 16:9, mínimo 1920×1080
- Slogan: ≤ 80 chars

### 6.4 Migração

Hoje o storefront mistura `slate-*` cru com `var(--brand-*)`. Plano:

1. Substituir todos `slate-*` por `n*` em `components/public/*` (find-replace).
2. Substituir `font-heading` (Syncopate) por `font-display` (Sora) — Syncopate fica deprecated.
3. Auditar contraste em todos os componentes que usam `var(--brand-primary)`.
4. Adicionar `BrandThemeProvider` wrapper que injeta as vars do tenant.

---

## 7. Plano de migração (em ondas)

Alinhado com o roadmap do `docs/SPEC-evolucao.md`.

### Onda 1 — Tokens + storefront (1 semana)
- [x] Atualizar `app/globals.css` com tokens completos (este SPEC + commit acompanhante)
- [ ] Adicionar utilitárias `shadow-*`, `radius-*`, `duration-*` no Tailwind
- [ ] Find-replace `slate-*` → `n*` em `components/public/`
- [ ] Deprecar `font-heading` (Syncopate) — log warning em runtime
- [ ] Corrigir `border-n300` que agora existe

### Onda 2 — Camada 1 de componentes (1 semana)
- [ ] `<Button>` com 5 variants, 3 sizes, loading state
- [ ] `<Card>` com 3 variants
- [ ] `<Input>` com states e helper text
- [ ] `<Skeleton>` para listagens
- [ ] `<Badge>` padronizado

### Onda 3 — Substituições estratégicas (1-2 semanas)
- [ ] `<Select>` (combobox) Radix nos filtros do marketplace
- [ ] `<Modal>`, `<Drawer>`, `<Toast>` Radix
- [ ] `<EmptyState>` em todas as listagens
- [ ] Refatorar `VehicleCard` do marketplace com novo design

### Onda 4 — Polimento por superfície (1-2 semanas)
- [ ] Redesenhar hero do marketplace
- [ ] Redesenhar hero do superadmin
- [ ] Mini-chart no dashboard admin
- [ ] Agrupamento de nav do admin
- [ ] Auditoria do laranja (rebaixar usos não-CTA)

---

## 8. O que ainda não está neste SPEC

Coisas conscientemente fora do escopo desta versão:

- **Dark mode** — tokens `ink-700/800/900` já preparam, mas a aplicação completa fica pra v2.
- **Internacionalização tipográfica** — Sora/Inter cobrem latino estendido bem; outros scripts ficam pra depois.
- **Ilustração custom** — usaremos Lucide + ícones do `docs/brand/icons` na v1; ilustrações próprias na v2.
- **Animação de marca** — splash, transição entre rotas com personalidade, vem na v2.
- **Print stylesheet** — relevante pra documentos PDF gerados, vem com a refatoração de PDFs.

---

## 9. Métricas de sucesso do design system

- **Adoção:** ≥ 90% dos componentes de UI usando tokens (auditável via grep de `slate-`, `gray-`, `#XXX` hardcoded)
- **Coerência:** uma demo cega para usuário externo identifica vitrine e painel como mesma marca
- **Performance:** Lighthouse Performance ≥ 90 mobile no marketplace pós-Onda 1
- **Velocidade de implementação:** novo componente de feature consumindo 1-2 componentes do system, sem CSS custom
- **Acessibilidade:** zero violações WCAG AA em axe-core para superfícies críticas (login, busca, detalhe de veículo)

---

**Próximo passo:** os tokens deste SPEC já foram aplicados em `app/globals.css` (mesmo commit). Próxima PR: refatorar `components/public/` para remover `slate-*` (Onda 1).
