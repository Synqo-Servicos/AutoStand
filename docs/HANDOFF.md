# Handoff — estado do projeto

**Última atualização:** 2026-05-28
**Último commit:** `d17ef07` (5d rate limit + CAPTCHA)

> Pega aqui pra retomar onde paramos sem precisar relembrar tudo.
> Vê também `docs/SPEC-evolucao.md`, `docs/SPEC-design-system.md`,
> `docs/Ideias.md` (backlog completo).

---

## O que ficou pronto recentemente

### Onda 1-4 — Design system completo
- Tokens: rampa neutra, radius, shadow, motion, z-index em `app/globals.css`
- Camada 1 (`components/ui/`): Button, Card, Input/Textarea/Field, Skeleton, Badge
- Camada 2: Select (Radix), Modal, Drawer, Toast (sonner), EmptyState
- Polimento por superfície: hero editorial marketplace, stacked bar admin,
  hero sóbrio console, scrolled navbar storefront

### Onda 5 — Robustez (completa)
- 5a defesa em profundidade (ownership de vehicleId, sanitização rota
  pública /api/vehicles/[id], allowlist superadmin, JWT 8h)
- 5b índices em tenant_id (11 índices, migration 0010) + `lib/platform.ts`
- 5c validação de upload (MIME + tamanho + magic bytes)
- 5d rate limit + CAPTCHA via Upstash + Turnstile — código pronto,
  no-op enquanto as 3 envs ficam vazias (`lib/ratelimit.ts`,
  `lib/turnstile.ts`, `components/Turnstile.tsx`). Protege `/api/assinar`
  e `/api/marketplace/lead`.

### Onda 6 — Estrutura que escala (completa)
- 6a wrappers `withTenant`/`withSuperAdmin` + zod — **todos os handlers
  migrados** (`/api/assinar`, `/api/marketplace/lead`, `/api/superadmin/*`,
  `/api/analise`, `/api/inteligencia`, `/api/personalizar` inclusos)
- 6b split `lib/db.ts` (997 linhas → 9 módulos em `lib/db/`)
- 6c smoke tests vitest (28 testes, ~840ms)

### Console super-admin
- Subdomínio `console.autostand.com.br` (em dev: `console.localhost:3000`)
- `requireConsoleHost()` em `lib/tenant.ts`
- **DNS no Vercel pendente** — adicionar domínio no Project Settings

### Gestão de fotos do veículo — completa (A, B, C, D)
- A: toolbar sempre visível (corrige bug touch), Modal de confirmação,
  pre-check client, grid responsivo 2/3/4 cols, limite 15 fotos
- B: drag-and-drop com @dnd-kit (Pointer + Touch + Keyboard sensors),
  DragOverlay, persistência otimista + rollback
- C: compressão client (`browser-image-compression`) + lightbox
  (`components/admin/Lightbox.tsx`)
- D: upload de logo/hero via `components/admin/ImageUpload.tsx`
- **Cleanup de blobs órfãos**: logo/hero ao trocar/remover, fotos+docs ao
  deletar veículo, tudo ao deletar tenant inteiro. Restrito a URLs do
  Vercel Blob (não apaga recursos externos).
- Stub de filesystem em dev: `lib/blob.ts` salva em `public/uploads/dev/`
  quando `BLOB_READ_WRITE_TOKEN` vazio

### Storefront config — completa (A, B, C, D)
- A: schema (migration 0011) — 10 colunas novas em tenants
  (slogan, about_heading, contact_cta_title/body,
  facebook/youtube/tiktok/twitter_url, address) + tabela
  `tenant_about_items`. DB em `lib/db/about.ts`. zod: `ABOUT_ICONS`
  (18 ícones Lucide), `aboutItemInputSchema`, `tenantStorefrontSchema`.
  Endpoints `GET/POST/PATCH /api/about`, `PATCH/DELETE /api/about/[id]`.
- B: UI no admin (`components/admin/PersonalizarEditor.tsx`) — forms de
  slogan/about_heading/contato/redes/endereço + `<AboutEditor>` (lista
  sortable de até 6 cards com palette de ícones Lucide)
- C: Storefront consome (`components/public/Storefront.tsx`,
  `StorefrontHero.tsx`, `Footer.tsx`) — `about_items` com fallback pros
  defaults, redes sociais no footer, slogan/CTA/about_heading custom
- D: upload de logo e hero via `/api/upload` (wrapper sobre `uploadToBlob`)

---

## O que ainda falta

### 1. Plumbing de produção (código pronto, falta só configurar)
- **Envs de Upstash + Turnstile** em prod (sem elas, rate limit e CAPTCHA
  viram no-op silencioso):
  - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (server)
  - `TURNSTILE_SECRET_KEY` (server), `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (client)
  - ⚠️ **Turnstile: setar as DUAS ou NENHUMA.** Só a SECRET → widget não
    renderiza mas servidor exige token → signup/lead públicos quebram.
    Só a SITE_KEY → CAPTCHA é silenciosamente bypassado. (verificação
    assimétrica conhecida em `lib/turnstile.ts` + `components/Turnstile.tsx`)
  - ⚠️ **Rate limit / IP:** `getClientIp` (`lib/ratelimit.ts`) usa o 1º hop
    do `x-forwarded-for` (spoofável) e cai em `"unknown"` sem header — todos
    no mesmo bucket. Aceitável na Vercel; revisar se sair da Vercel.
- **Migrations pendentes em prod (Turso)**:
  - `drizzle/0010_medical_xavin.sql` — índices em tenant_id
  - `drizzle/0011_new_invisible_woman.sql` — tenants colunas novas + tenant_about_items
  - Aplicar via `npx drizzle-kit push` no Turso de prod ou SQL direto no painel
- **Vercel DNS**: apontar `console.autostand.com.br` em Settings → Domains
- **Vercel Blob**: configurar `BLOB_READ_WRITE_TOKEN` em prod

### 2. Milestone 2 — Billing (a frente de produto que destrava receita)
- Self-service, customização por plano e onboarding já existem.
- **Falta só o pagamento (Stripe)** — checkout + webhook + gating por plano.
  Ver `docs/Milestone 2.md` e `docs/Planos e Preços.md`.

### 3. Backlog (futuro, ver `docs/Roadmap.md` + `docs/Ideias.md`)
- Multi-usuário por concessionária (hoje 1 `tenant_admin` por tenant)
- Automação do registro de domínio próprio via API da Vercel
- Integração FIPE, simulador de financiamento
- Milestone 3 (Automação): automação via WhatsApp Cloud API + histórico de contato

---

## Como retomar (comandos)

```bash
# Dev server
npm run dev
# Testes (28 verde no momento)
npm test
# Build
npx next build
# Migration (se mexer em lib/schema.ts)
npx drizzle-kit generate
```

### Credenciais de teste
- Tenants: `admin@autoprime.com`/`demo123`,
  `admin@garagem082.com.br`/`garagem123`,
  `admin@premiummotors.com.br`/`premium123`
- Super-admin: `super@plataforma.com`/`super123`
  (só em `console.localhost:3000/superadmin/login`)

### URLs locais
- Marketplace: `http://localhost:3000`
- Storefront: `http://<slug>.localhost:3000` (autoprime, garagem082, premiummotors)
- Admin loja: `http://<slug>.localhost:3000/admin/login`
- Console: `http://console.localhost:3000/superadmin/login`

### Dev BLOB
- Sem `BLOB_READ_WRITE_TOKEN` em `.env.local`, uploads vão pra
  `public/uploads/dev/` (gitignored)
- Pra plugar token local: `vercel env pull .env.local --environment=development`

---

## Decisões importantes do design

- **Whitelabel storefront** usa `--brand-*` (cor da loja); estrutura,
  tipografia, spacing, radius vêm do AutoStand
- **Laranja `signal`** reservado a CTA primário e dado-destaque (regra
  do 15%) — não é cor decorativa
- **Console em subdomínio dedicado** (`console.autostand.com.br`) por
  obscurity + separação de surface (padrão Stripe/Vercel)
- **`order_idx`** vs `position`: vehicle_photos usa `order_idx`,
  tenant_about_items usa `position`. Inconsistência por chegada em
  momentos diferentes — não vale refator agora
- **Cleanup de blob restrito a URLs do Vercel Blob** — nunca apaga
  recursos externos passados por URL nos formulários
