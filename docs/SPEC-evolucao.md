# SPEC de Evolução — AutoStand

**Versão:** 1.0 · **Data:** 2026-05-26 · **Status:** Triagem priorizada para próxima onda

> Este documento consolida três auditorias paralelas (design/UX, segurança, arquitetura/código) feitas sobre o estado atual da plataforma em produção. O objetivo é deixar o AutoStand **mais vendável, mais profissional e visualmente impressionante** — corrigindo o que hoje passa "amador" e amplificando o que já está sólido.

---

## 1. Onde estamos

### 1.1 O que o AutoStand é hoje

Plataforma SaaS multi-tenant para concessionárias de seminovos. Cada loja cliente recebe:

- Site público próprio em `<slug>.autostand.com.br` (ou domínio próprio).
- Painel administrativo com estoque, leads (CRM), transações, vendedores + comissões, financeiro, documentos PDF, módulos de IA (análise e inteligência de mercado).
- Exposição opcional no marketplace AutoStand (`autostand.com.br`).

Existe ainda um console super-admin para a operação da plataforma (cadastrar tenants, parceiros, ver KPIs globais).

### 1.2 Mapa arquitetural

**Stack:** Next.js 15 (App Router), Drizzle ORM sobre libSQL/Turso, NextAuth v5 (JWT + Credentials), Tailwind v4 com tokens semânticos, deploy Vercel, IA via Anthropic SDK, storage via `@vercel/blob`, billing via Stripe.

**Modelo de tenancy:** "shared database, `tenant_id` em toda linha de domínio". Resolução por host (`lib/tenant.ts`):

- `<slug>.autostand.com.br` → `getTenantBySlug(slug)`
- Custom domain → `getTenantByDomain(host)`
- `autostand.com.br` (e demais `PLATFORM_HOSTS`) → sem tenant; vitrine e superadmin

**Três superfícies, três route groups:**

| Superfície | Onde mora | Quem vê |
|---|---|---|
| Vitrine pública / marketplace | `app/(public)/*` resolvido em platform host | Compradores |
| Storefront da loja | `app/(public)/*` resolvido em `<slug>.autostand.com.br` | Compradores da loja |
| Admin do lojista | `app/admin/(protected)/*` | tenant_admin |
| Super-admin | `app/superadmin/(panel)/*` | super_admin |

**Camadas:**
- **Data:** `lib/db.ts` (951 linhas, tudo via Drizzle) + `lib/marketplace.ts` (única exceção cross-tenant, somente leitura, colunas públicas).
- **Auth:** `lib/auth.ts` — JWT carrega `role` + `tenantId`. Helpers `getApiTenantId()` e `isSuperAdmin()` para rotas.
- **Components:** segregados por superfície (`admin/`, `marketing/`, `marketplace/`, `public/`, `superadmin/`).

**Schema (resumo):** `tenants`, `users`, `vehicles`, `vehicle_photos`, `vehicle_documents`, `transactions`, `sellers`, `leads`, `partners`, `demand_events`. Todas as tabelas de domínio têm `tenant_id` com `onDelete: cascade`.

### 1.3 O que já está sólido

- **Isolamento multi-tenant correto** — toda função de `lib/db.ts` filtra por `tenant_id`; `lib/marketplace.ts` é a única exceção e expõe só colunas públicas. **Não há vulnerabilidade de leitura cross-tenant.**
- **Convenção forte de `tenantId` como primeiro argumento** em toda função de data layer — fácil de auditar.
- **Resolução de host em três modos** (slug, custom domain, platform) bem desenhada.
- **Endpoints super-admin com `isSuperAdmin()` consistente**; admin layout valida `session.user.tenantId === tenant.id` (defesa em profundidade).
- **Senhas com bcrypt(12)**; slugs com lista de reservados; sem `dangerouslySetInnerHTML`; sem `process.env.*` em client components; sem SQL injection (Drizzle parametriza).
- **Tokens semânticos** declarados em `tailwind.config.ts` (paleta `ink/signal/sand/n*`, tipografia Sora/Inter/Syncopate) — base de design system existe.

---

## 2. Triagem priorizada de achados

Severidade: **H** = visivelmente quebra confiança / risco real / dor de manutenção. **M** = polimento que diferencia / risco contido. **L** = nice-to-have.

### 2.1 Design / UX

#### Storefront da loja
- **[H]** Storefront mistura `slate-*` cru do Tailwind com tokens AutoStand (`var(--brand-*)`, `n*`). Resultado: vitrine "azulada", desalinhada da marca da concessionária. `components/public/Storefront.tsx:46-76`, `VehicleCard.tsx:14-32`, `StorefrontHero.tsx:54`, `Navbar.tsx:13`.
- **[H]** `StorefrontHero` usa Syncopate em maiúsculas — vira bloco agressivo "oficina mecânica", não combina com "concessionária multimarca premium". As stats `100% / 0 / Direto` parecem placeholder. `components/public/StorefrontHero.tsx:50`.
- **[M]** Seção "Sobre" usa `✓` como string emoji — visual de slide PowerPoint. `Storefront.tsx:85-99`.
- **[M]** Navbar sem estado "scrolled"; `text-slate-300` hardcoded quebra contraste WCAG em lojas com cor primária clara. `components/public/Navbar.tsx:13`.

#### Vitrine pública / marketplace
- **[H]** Hero do marketplace é bloco azul-marinho chapado com input flutuando — parece template Bootstrap. `components/marketing/MarketplaceLanding.tsx:18-44`. Falta hero image, mosaico de fotos, ou textura/grid que dê materialidade.
- **[H]** Tipografia da home tímida — `text-h1` (40px) com fallback 52px no sm, quando o token `--text-display` prevê 56px. `font-display` (Sora) não respira. `components/marketing/PlatformLanding.tsx:17`, `MarketplaceLanding.tsx:23`.
- **[H]** Cards do marketplace são idênticos a OLX/Webmotors — sem hover real, badge "Único dono" perde leitura sobre fotos claras, sem logo da loja, sem chips de feature. `components/marketplace/MarketplaceVehicleCard.tsx`.
- **[M]** Filtros desktop usam `<select>` nativo do browser — quebra a identidade premium. `components/marketplace/MarketplaceFilters.tsx:84-117`. Deveria ser combobox/popover estilizado (Radix/Headless UI).
- **[M]** Página `/lojas` tem cards minúsculos, logo 56×56 em quadrado cinza opaco, zero hierarquia editorial; nenhum highlight para lojas com mais estoque. `app/(public)/lojas/page.tsx:31-58`.
- **[M]** Classe `border-n300` em `MarketingHeader.tsx:27` e `MarketplaceLanding.tsx:74,113` — token n300 não existe (`@theme` define n200, n400, n600, n900). Border invisível.

#### Admin do lojista
- **[H]** Dashboard tem 3 caixas chapadas idênticas para "Disponível / Reservado / Vendido" — sem cor, sem ícone, sem proporção visual. `app/admin/(protected)/dashboard/page.tsx:38-56`. Devia ser stacked bar ou donut compacto.
- **[M]** `DashboardCard` duplica linha laranja (`ring-1 ring-signal` + `border-signal`) no card acentuado. `components/admin/DashboardCard.tsx:10`.
- **[M]** Sidebar tem 12 itens sem agrupamento (Gestão / Vendas / Marketing / Conta). "Análise IA" e "Inteligência" quase indistinguíveis. `components/admin/AdminSidebar.tsx:12-25`.
- **[M]** `text-n400` (cor "texto desabilitado") usado em metadados de tabela (cor/km) que deveriam ser `text-n600`. `app/admin/(protected)/veiculos/page.tsx:69` e várias outras.

#### Super-admin
- **[H]** Hero do dashboard é gradient laranja `from-signal to-signal-dark` desproporcional — quebra a regra do próprio manual ("máx. 15% da peça") e diverge do tom sóbrio do console. `app/superadmin/(panel)/dashboard/page.tsx:21-41`. Visual de SaaS B2C, não console de plataforma.
- **[M]** Stat tiles com `border-n200/70` enquanto admin usa `border-n100` — inconsistências de borda que somam.
- **[M]** Badge `bg-success/12 text-ink` — preto sobre verde 12% transparente tem leitura ruim.

#### Achados transversais
- **[H]** Storefront whitelabel usa `slate-*` e o resto da plataforma usa `n*`/`ink` — **dois design systems no mesmo monorepo**.
- **[H]** Inflação de `signal` (laranja): usado em badges, nav-active, anéis de foco, hero do superadmin, links inline, ícones de KPI, "ver todos →", CTAs. Quando tudo é destaque, nada é.
- **[M]** Zero skeletons, zero shimmer, zero ilustração em empty states. Sensação de "tabela vazia + parágrafo cinza" em toda a plataforma.
- **[M]** Hover só muda cor — sem elevação progressiva, sem outline animado, sem feedback de pressed. Falta micro-motion para passar "qualidade".
- **[L]** Sem dark mode apesar do token `--color-ink-800` existir.

### 2.2 Segurança

> Estado geral: **0 CRÍTICO, 4 HIGH, 6 MED**. Sem hijack, sem escalação de privilégio, sem leak cross-tenant. Os riscos reais são abuso de endpoints públicos e qualidade defensiva contra atacante interno/comprometido.

- **[H]** **Endpoints públicos sem rate limit nem CAPTCHA** — `POST /api/leads`, `POST /api/marketplace/lead`, `POST /api/assinar`. Vetor de DoS + poluição de dados + consumo de CPU em `bcrypt(12)`. `app/api/leads/route.ts:24-49`, `app/api/marketplace/lead/route.ts:9-43`, `app/api/assinar/route.ts:26-78`.
- **[H]** **Upload de arquivos sem validação de MIME / tamanho / magic bytes** — `lib/blob.ts` aceita qualquer extensão e sobe como `access: "public"` na Vercel Blob. Permite hosting de phishing/malware sob subdomínio Vercel e gasto de storage ilimitado. Usado em `app/api/vehicles/[id]/photos/route.ts:25` e `documents/route.ts:33`.
- **[H]** **POST de fotos/documentos não valida ownership do veículo** — `vehicleId` vem da URL e é gravado direto. Atacante consegue criar fotos/documents com `tenant_id` próprio mas `vehicle_id` da vítima — pollution de DB e pivô para futuros endpoints com join por `vehicle_id`. `app/api/vehicles/[id]/photos/route.ts:18-43`, `documents/route.ts:23-58`.
- **[H]** **Mass assignment em `/api/superadmin/tenants`** — `POST` e `PATCH` aceitam corpo inteiro sem allowlist. Permite setar `stripe_subscription_id`, `subscription_status`, `referred_by`, `custom_domain` arbitrariamente. Defesa em profundidade ausente.
- **[M]** **Endpoint público `GET /api/vehicles/[id]` retorna `cost_price` e `fipe_code`** — vaza margem de lucro no site da loja. `lib/marketplace.ts` faz o filtro correto via `VEHICLE_PUBLIC`, mas essa rota usa `getVehicleWithPhotos` direto.
- **[M]** **`createTransaction` aceita `vehicle_id`/`seller_id` de outros tenants** — não há leak imediato (updates filtram por tenant) mas gera linhas órfãs com FK cross-tenant.
- **[M]** **JWT sem `maxAge` explícito** — herda default de 30 dias; role/tenantId congelados no login. Token roubado vale 30 dias.
- **[M]** **`tenant.status === "suspended"` ainda permite mutações via API** — decisão de produto não documentada na barreira técnica.
- **[M]** **`updateTenant` sem allowlist** — hoje os handlers filtram, mas se alguém ampliar um endpoint herda mass assignment.

### 2.3 Arquitetura & Qualidade de Código

- **[H]** **`PLATFORM_DOMAIN` duplicado em 6 lugares** — `lib/tenant.ts:20`, `lib/marketplace.ts:5`, `app/robots.ts:3`, `app/sitemap.ts:8`, `app/layout.tsx:5`, `next.config.ts:3`. Mudar domínio é six-find-replace.
- **[H]** **Zero validação de input nas rotas POST/PUT/PATCH** — `zod` no `package.json` mas só `lib/ai.ts` usa. Handlers fazem `await req.json()` e passam direto pro Drizzle.
- **[H]** **Nenhum índice em tabelas tenant-scoped** — apenas FKs. `WHERE tenant_id = ? AND status = ?` é table-scan em qualquer listagem. À medida que o número de tenants × veículos cresce, dashboard fica lento.
- **[H]** **Sem testes apesar de `vitest` configurado** — funções críticas (`tenant resolution`, `computeCommission`, `eligible()` do marketplace, `periodWhere` financeiro) não têm cobertura. São puras e ideais pra teste.
- **[M]** **`catch (err)` repete em ~15 rotas com tratamento inconsistente** — algumas logam, maioria silencia, IA usa `catch {}` (engole tudo).
- **[M]** **Auth check duplicado em todo handler** — `getApiTenantId()` + 401 em 4-5 linhas no topo de cada rota.
- **[M]** **`lib/db.ts` com 951 linhas** — já tem comentários `--- Vehicles ---`, `--- Sellers ---` etc. Pediria split por domínio em `lib/db/`.
- **[L]** **Inconsistência pt/en nas rotas** — `/api/veiculos/[id]/legenda` vs `/api/vehicles/[id]`, `/api/transacoes` (página) vs `/api/transactions` (API).

---

## 3. Plano de evolução

> Roadmap em três ondas, ordenado por **impacto em vendabilidade × esforço**. Esforço: **S** = horas, **M** = 1-2 dias, **L** = 3-5 dias.

### Onda 1 — Polimento perceptível (1-2 semanas)
*O que um comprador / lojista vê em 30 segundos no site.*

| # | Ação | Onde | Esforço |
|---|---|---|---|
| 1.1 | Unificar storefront no design system: substituir todo `slate-*` por `n*`/`ink` em `components/public/*` | `components/public/Storefront.tsx`, `VehicleCard.tsx`, `StorefrontHero.tsx`, `Navbar.tsx`, `Footer.tsx` | M |
| 1.2 | Redesenhar hero do marketplace com mosaico de fotos reais do estoque + tipografia respirada (display 56px) | `components/marketing/MarketplaceLanding.tsx` | M |
| 1.3 | Substituir `<select>` nativos por combobox custom (Radix/Headless UI) nos filtros do marketplace | `components/marketplace/MarketplaceFilters.tsx` | M |
| 1.4 | Card de veículo marketplace: logo da loja, chips de feature (câmbio/combustível), hover de elevação (shadow + ring) | `components/marketplace/MarketplaceVehicleCard.tsx` | S |
| 1.5 | Substituir 3 caixas de stock por mini-chart (stacked bar) no dashboard admin | `app/admin/(protected)/dashboard/page.tsx:38-56` | M |
| 1.6 | Domar o hero do superadmin: trocar gradient laranja por superfície `bg-ink` + accent `signal` só no eyebrow/CTA | `app/superadmin/(panel)/dashboard/page.tsx:21-41` | S |
| 1.7 | Trocar `✓` string por ícones Lucide consistentes no "Sobre" do storefront | `components/public/Storefront.tsx:82-101` | S |
| 1.8 | Agrupar nav do admin em "Operação / Vendas / Marketing / Conta" com divisor | `components/admin/AdminSidebar.tsx:12-25` | S |
| 1.9 | Skeletons para listas (marketplace, admin/veiculos, superadmin/tenants); criar `components/ui/Skeleton.tsx` | vários | M |
| 1.10 | Quick wins de tokens: corrigir `border-n300` inexistente, `text-n400` → `text-n600` em metadados, alinhar `border-n100`/`border-n200` global | varredura | S |

### Onda 2 — Robustez e confiança (2-3 semanas)
*O que protege contra abuso e o que faz crescer sem quebrar.*

| # | Ação | Onde | Esforço |
|---|---|---|---|
| 2.1 | **Rate limit + CAPTCHA** em `/api/leads`, `/api/marketplace/lead`, `/api/assinar` (`@upstash/ratelimit` + Cloudflare Turnstile) | 3 handlers + middleware | M |
| 2.2 | **Validação de upload**: allowlist de MIME, limite de tamanho (8MB foto / 20MB doc), checagem de magic bytes | `lib/blob.ts` + 2 handlers | M |
| 2.3 | **Validar ownership de `vehicleId`** nos POST de fotos/documentos | 2 handlers (1 linha cada) | S |
| 2.4 | **Allowlist de campos** em `updateTenant` (lib/db) + handlers superadmin | `lib/db.ts:67-79`, 2 handlers | S |
| 2.5 | **Endpoint público `/api/vehicles/[id]` retornar só colunas públicas**; criar `getPublicVehicleById` espelhando `VEHICLE_PUBLIC` | `lib/db.ts`, `app/api/vehicles/[id]/route.ts` | S |
| 2.6 | **Validar `vehicle_id`/`seller_id` em `createTransaction`** | `lib/db.ts:373-431` | S |
| 2.7 | **JWT `maxAge: 8h`** + revalidar role no `jwt({ trigger })` | `lib/auth.ts:31-50` | S |
| 2.8 | **Adicionar índices** em `(tenant_id)` e `(tenant_id, status)` em vehicles, transactions, leads, sellers, photos, documents | `lib/schema.ts` + migration | S |
| 2.9 | **Centralizar `PLATFORM_DOMAIN`** em `lib/platform.ts` e importar de lá em todos os call sites | 6 arquivos | S |
| 2.10 | **Definir comportamento de tenant suspenso**: bloquear writes via API ou documentar a permissão | rotas de write | S |

### Onda 3 — Estrutura que escala (3-4 semanas)
*O que faz o time crescer sem dor; o que o investidor olha no due-diligence.*

| # | Ação | Onde | Esforço |
|---|---|---|---|
| 3.1 | **Schemas zod por tabela** em `lib/schema-zod.ts`; aplicar `safeParse()` em todas as rotas mutadoras | `lib/schema-zod.ts` + ~15 handlers | M |
| 3.2 | **Wrappers `withTenant(handler)` e `withSuperAdmin(handler)`** que injetam tenantId/sessão e tratam 401/403/500 | `lib/api.ts` + refactor ~25 handlers | M |
| 3.3 | **Quebrar `lib/db.ts`** em `lib/db/{vehicles,transactions,leads,sellers,tenants,users,partners,demand}.ts` re-exportados por `lib/db/index.ts` | 1 grande refactor sem mudança de comportamento | L |
| 3.4 | **Smoke tests com vitest** em `lib/tenant.ts`, `lib/marketplace.ts:eligible`, `computeCommission`, `periodWhere` (4-5 funções, ~30 testes) | `tests/` | M |
| 3.5 | **Auditoria do uso de `signal`** (laranja): rebaixar em badges/anéis/links inline; reservar exclusivamente para CTAs primários e dados-destaque | varredura global | M |
| 3.6 | **Micro-motion**: hover com elevação progressiva, transição de outline, feedback de pressed em todos os componentes interativos | tokens + componentes | M |
| 3.7 | **Padronizar pt/en nas rotas** — sugestão: tudo en nos endpoints internos, pt-BR só nas rotas de página | refactor + redirects | M |
| 3.8 | **Audit log** centralizado de mutações sensíveis (create/update/delete tenant, transactions, users) via `withTenant`/`withSuperAdmin` | nova tabela + middleware | M |

---

## 4. O que muda na narrativa de venda

Hoje, demonstrando o produto, alguns pontos puxam o pitch pra baixo:

1. **Storefront da loja parece outro produto** — cliente compara com o marketplace e estranha. **Pós Onda 1:** uma plataforma só, identidade coesa, branding da loja em cima.
2. **Cards do marketplace parecem OLX** — não diferencia. **Pós Onda 1:** card com logo da loja + chips premium + hover, separa "marketplace de concessionárias confiáveis" de "agregador genérico".
3. **Hero do superadmin é amador** — quem fizer due-diligence vê. **Pós Onda 1:** console sóbrio que passa "infraestrutura séria".
4. **Endpoints públicos abertos** — risco real se aparecer no Hacker News. **Pós Onda 2:** rate limit + CAPTCHA + uploads validados.
5. **`lib/db.ts` de 951 linhas, zero teste** — eliminatório em auditoria técnica. **Pós Onda 3:** módulos pequenos + cobertura nos pontos críticos + zod + wrappers.

Cada onda fecha um conjunto de objeções. A Onda 1 é a que **mais paga em demo**; a 2 é a que **mais paga em conversa com cliente enterprise / parceiro**; a 3 é a que **mais paga em rodada de investimento / contratação técnica**.

---

## 5. O que NÃO está no escopo deste SPEC

- **Reescrita de copy** (marketing, landing, e-mails transacionais) — vale uma SPEC própria com revisão de tom de voz.
- **Onboarding do lojista** (fluxo `/assinar` → primeiro veículo cadastrado → primeiro lead) — pode ser próxima onda dedicada.
- **Mobile app nativo** — fora de horizonte; PWA pode ser considerado.
- **Internacionalização** — projeto é pt-BR-only por enquanto.
- **Programa de afiliados / parceiros** — schema existe, fluxo não está auditado.

---

## 6. Métricas de sucesso

Como saber que a evolução pegou:

- **Demo qualitativa:** apresentar antes/depois pra 3 lojistas e pra 1 investidor. Coletar a primeira frase de cada um.
- **Tempo de carregamento:** Lighthouse Performance ≥ 90 em mobile no marketplace + storefront (pós Onda 1).
- **Conversão de visitante → lead** no marketplace (instrumentar via `demand_events`).
- **Custo de incidente evitado:** rate limit em produção, conferir queda em spam de leads (se houver hoje).
- **Velocity do time:** PRs em `lib/db/*` (pós Onda 3) devem ficar abaixo de ~200 LOC; tempo de revisão menor.

---

**Próximo passo recomendado:** abrir uma issue/milestone "Onda 1 — Polimento perceptível" com os 10 itens da tabela 3.1, e fechar a primeira em 1-2 sprints.
