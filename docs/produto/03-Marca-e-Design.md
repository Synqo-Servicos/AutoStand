# Marca e Design — AutoStand

> Identidade visual, sistema de design e tom de voz, extraídos do código (fonte da verdade:
> `app/globals.css`, `components/ui/*`, `docs/brand/*`) e das notas de marca.
> Base para o **Manual da Marca**. Os valores aqui são os reais do produto.

---

## 1. Essência da marca

O AutoStand combina **rigor editorial premium** com **funcionalidade de SaaS**. A marca
transmite que a revenda passou a operar com profissionalismo — sem perder a clareza e a
proximidade que o lojista independente valoriza.

**Atributos:** profissional, direto, confiável, caloroso (não frio/corporativo),
orientado a resultado.

**O laranja é cirúrgico.** A cor de ação aparece em no máximo ~15% da tela — só em
chamadas e dados de destaque. O restante é construído com azul-marinho, neutros quentes e
muito espaço em branco. A hierarquia se faz por **tamanho e tipografia**, não por excesso
de cor.

---

## 2. Nome e wordmark

- **Nome:** AutoStand (uma palavra, "A" e "S" maiúsculos).
- **Wordmark:** tipografia Sora, peso semibold, com leve aperto de espaçamento (`tracking-tight`).
- O componente de logo (`components/marketing/Logo.tsx`) compõe **símbolo + wordmark** em duas versões de tom: `dark` (sobre fundo claro) e `light` (sobre fundo escuro).

---

## 3. Símbolo e ícones

**Símbolo (monograma A+S):** duas formas geométricas que se interconectam, em arquivo
`docs/brand/autostand-symbol.svg`.

- Forma ascendente/dinâmica em **laranja** (`#FF6A1A`).
- Forma descendente/estável em **azul-marinho** (`#0B1F33`).

| Versão | Arquivo | Quando usar |
|---|---|---|
| Positiva | `docs/brand/autostand-symbol.svg` | Sobre fundo claro (branco, areia). |
| Negativa | `docs/brand/autostand-symbol-negative.svg` | Sobre fundo escuro (azul-marinho, preto). |
| Ícone de app | `docs/brand/autostand-app-icon.svg` | Quadrado de cantos arredondados, fundo azul-marinho, símbolo em branco/laranja. |

**Ícones em resolução (PWA/favicon):** `docs/brand/icons/icon-{16,32,180,192,512}.png`.
No app: `app/icon.png` (favicon), `app/apple-icon.png` (iOS), `app/favicon.ico`.

---

## 4. Sistema de cores

> Tokens definidos em `app/globals.css` (Tailwind v4 com `@theme`). Convenção da rampa
> neutra: **número maior = mais escuro**.

### 4.1 Institucional (primária e ação)

| Token | Hex | Uso |
|---|---|---|
| `--color-ink` | `#0B1F33` | Azul-marinho. Texto primário, fundos escuros, âncora visual da marca. |
| `--color-ink-700` | `#1E3A55` | Hover de superfície escura. |
| `--color-ink-800` | `#15324D` | Superfície escura elevada. |
| `--color-ink-900` | `#061629` | Superfície escura profunda (overlays). |
| `--color-signal` | `#FF6A1A` | Laranja de ação. CTAs e destaque — **máx. 15% da tela**. |
| `--color-signal-dark` | `#D9521A` | Hover/pressed do laranja. |
| `--color-signal-soft` | `#FFF1E8` | Fundo tonal de destaque (uso muito limitado). |

### 4.2 Neutros quentes (superfícies premium)

| Token | Hex | Uso |
|---|---|---|
| `--color-sand` | `#F5F1EA` | Areia. Fundo quente que substitui o branco puro em cards premium. |
| `--color-sand-dark` | `#EBE5DA` | Hover/borda sobre areia. |

### 4.3 Rampa neutra de interface

| Token | Hex | Uso |
|---|---|---|
| `--color-n50` | `#F6F7F8` | Fundo do app. |
| `--color-n100` | `#EAEDEF` | Superfícies sutis, cards em fundo n50. |
| `--color-n150` | `#E0E4E8` | Divisor suave, base do skeleton. |
| `--color-n200` | `#D5DADF` | Bordas e divisores padrão. |
| `--color-n300` | `#BFC6CD` | Borda forte, borda de input. |
| `--color-n400` | `#94A0AB` | Ícones leves, texto desabilitado, placeholder. |
| `--color-n500` | `#7C8895` | Texto muted, ícone secundário. |
| `--color-n600` | `#6B7A88` | Texto secundário (padrão de descrição). |
| `--color-n700` | `#4F5D6B` | Texto secundário forte, labels. |
| `--color-n800` | `#33414F` | Texto quase-primário sobre fundo claro. |
| `--color-n900` | `#0B1F33` | Alias de `--color-ink`. |

### 4.4 Semânticas (feedback — só no produto, nunca em peça de marca)

| Token | Hex | Uso |
|---|---|---|
| `--color-success` | `#2BB673` | Sucesso, venda concluída, disponível. |
| `--color-success-dark` | `#1F8C57` | Texto de sucesso sobre fundo claro. |
| `--color-warning` | `#F2B600` | Atenção, pendência, reservado. |
| `--color-warning-dark` | `#B8860B` | Texto de atenção sobre fundo claro. |
| `--color-danger` | `#C8102E` | Erro, ação destrutiva, suspensão. |
| `--color-danger-soft` | `#FDECEE` | Fundo tonal de erro. |

### 4.5 Regra de contraste (WCAG AA — obrigatória)
- Texto sobre **laranja** ou **amarelo**: sempre `ink`, **nunca branco** (branco sobre laranja dá ~2,9:1 e reprova). Botão laranja ⇒ rótulo em `ink`.
- Laranja **como texto** apenas sobre fundo escuro.
- `success` e `warning` são claros demais para texto: use-os como fundo tonal (`bg-success/12`), anel, ponto ou ícone, com o texto em `ink` ou na versão `-dark`. `danger` (vermelho escuro) pode ser texto.

---

## 5. Tipografia

Duas famílias (Google Fonts, licença SIL OFL), carregadas via `@import` no `globals.css`
e com arquivos em `lib/fonts/`:

- **Sora** (`--font-display`) — títulos, números grandes, KPIs, impacto. Pesos 400/600/700.
- **Inter** (`--font-body`) — corpo, UI, microcopy, formulários. Pesos 300–700.

> A fonte `Syncopate` (`--font-heading`) é **legado** do storefront whitelabel — não faz
> parte da marca AutoStand e não deve ser usada em superfícies da plataforma.

### Escala tipográfica

| Token | Tamanho / linha | Família · peso | Uso |
|---|---|---|---|
| `text-display` | 56px / 1.05 | Sora 700 | Headline de capa. |
| `text-h1` | 40px / 1.10 | Sora 600 | Título de página. |
| `text-h2` | 30px / 1.15 | Sora 600 | Seções principais. |
| `text-h3` | 22px / 1.25 | Sora 600 | Subseções, títulos de card. |
| `text-body-l` | 18px / 1.55 | Inter 400 | Parágrafo de destaque, lead. |
| `text-body` | 16px / 1.55 | Inter 400 | Corpo padrão. |
| `text-body-s` | 14px / 1.50 | Inter 400 | Auxiliar, legendas, helper. |
| `text-eyebrow` | 12px / 1.40 (·0.22em) | Inter 600 | Sobretítulo — usar com `UPPERCASE`. |

Hierarquia: uma página = um `text-display` **ou** um `text-h1` (nunca os dois);
`text-h2` é a granularidade mais comum.

---

## 6. Componentes de interface

Biblioteca em `components/ui/*` (Tailwind v4, vários sobre Radix UI). Resumo das variantes:

| Componente | Variantes / destaque |
|---|---|
| **Button** | `primary` (laranja, texto ink), `secondary` (ink, texto branco), `outline`, `ghost`, `danger`. Tamanhos sm/md/lg. Suporta loading, ícones e estados de foco/pressed. |
| **Badge** | `neutral`, `available`, `pending`, `sold`, `suspended`, `highlight`, `info`. Sempre pílula, com fundo tonal + texto legível + ponto/anel colorido. |
| **Card** | `surface` (branco), `elevated` (areia, premium), `interactive` (clicável). Cantos `rounded-xl` (16px). Sub-partes: Header, Title, Description, Body, Footer. |
| **Input / Textarea / Field** | Borda n300, foco com anel ink, estado inválido em danger. Wrapper `Field` com label, obrigatório e helper. |
| **Select** | Sobre Radix; trigger e dropdown com check em laranja; suporta grupos. |
| **Modal** | Sobre Radix Dialog; overlay com blur; tamanhos sm–xl; header/body/footer. |
| **Drawer** | Painel lateral (esquerda/direita/baixo); usado em filtros mobile e ações densas. |
| **Toast** | Sobre Sonner; tipos success/error/warning/info; canto superior direito. |
| **Skeleton** | Variantes text/circle/rect/card com shimmer; respeita `prefers-reduced-motion`. |
| **EmptyState** | Padrão obrigatório para listas vazias: ícone + título + descrição + CTA. |

### Tokens de forma e profundidade
- **Raios:** xs 4px · sm 6px · md 8px · lg 12px · xl 16px · 2xl 24px · full. Regra: **filho < pai** (elemento interno arredonda menos que o contêiner).
- **Sombras:** todas baseadas em `rgba(11,31,51,0.0X)` (azul-marinho com baixa opacidade), de `xs` (borda elevada) a `xl` (modal). Nada de preto/branco puro nem Material pesado.
- **Movimento:** padrão 150ms `ease-out` para interações; 240ms para transições de página. Sem bounce no produto.

---

## 7. Princípios visuais

1. **Tipografia em primeiro plano** — Sora para hierarquia, Inter para legibilidade.
2. **Fotos como protagonistas** — imagem de carro com espaço generoso, nunca decorativa.
3. **Minimalismo com calor** — usar `sand` (creme) em superfícies premium; evitar cinza frio.
4. **Laranja cirúrgico** — só CTAs e destaque; máx. ~15% da tela.
5. **Cantos sempre arredondados** — mínimo 6px (inputs), máximo 24px (heros).
6. **Sombras sutis** — ~4% de opacidade base.
7. **Espaço é luxo** — padding generoso (24–32px), respiro entre seções (64–96px).
8. **Contraste primeiro** — nunca texto branco sobre laranja; hierarquia por tamanho, não por cor.

---

## 8. Whitelabel: a fronteira entre a marca AutoStand e a do cliente

O sistema tem **dois conjuntos de variáveis de tema** que convivem — trocar um pelo outro
é o erro mais fácil de cometer.

| | Tema da plataforma | Tema do tenant (whitelabel) |
|---|---|---|
| **Variáveis** | `--color-*`, `--font-*`, `--text-*` | `--brand-primary`, `--brand-accent`, … |
| **Origem do valor** | fixo (este manual) | banco — cores do cadastro da loja |
| **Veste** | Painel `/admin`, Console `/superadmin`, `autostand.com.br` | o **site público** de cada concessionária |

> **Regra:** no site público da loja usa-se **apenas** `--brand-*` (o cliente escolhe as
> cores). Nas superfícies da plataforma usa-se **apenas** os tokens `--color-*` (a marca
> AutoStand). A marca AutoStand nunca aparece no site do cliente além de um discreto
> "Tecnologia AutoStand" no rodapé.

---

## 9. Tom de voz

Derivado da comunicação real do produto (landing e microcopy). O AutoStand fala como um
**sócio operacional**, não como um software corporativo:

- **Direto e sem jargão.** "Venda mais. Improvise menos." · "Cada número no seu lugar."
- **Do lado do lojista.** "Software que respeita o lojista." · "Do lado da loja, todo dia."
- **Concreto, orientado a resultado.** Fala de margem, leads, comissão — não de "soluções".
- **Frases curtas.** Microcopy enxuta; verbos no imperativo nos CTAs ("Assinar agora", "Ver estoque").
- **Caloroso, não informal demais.** Profissional e próximo, sem gírias.

**Exemplos de referência (copy do produto):**
> "A AutoStand integra estoque, CRM, financeiro e comissões em uma só plataforma. Sem
> retrabalho, sem planilha solta, sem decisão no escuro."
>
> "Não é só um sistema. É um sócio operacional."
>
> Pilares: **Controle** ("Cada número no seu lugar") · **Clareza** ("Software que respeita
> o lojista") · **Parceria** ("Do lado da loja, todo dia").
