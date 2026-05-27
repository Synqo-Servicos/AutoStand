# Handoff — estado do projeto

**Última atualização:** 2026-05-27
**Último commit:** `9d5ee32` (sub-onda A da config de storefront)

> Pega aqui pra retomar onde paramos sem precisar relembrar tudo.
> Vê também `docs/SPEC-evolucao.md`, `docs/SPEC-design-system.md`,
> `docs/Ideias.md` (backlog completo).

---

## O que ficou pronto recentemente

### Onda 1-4 — Design system completo
- Tokens (`lib/blob-constants.ts` aliás, sim, mas o ponto é: rampa neutra completa, radius, shadow, motion, z-index em `app/globals.css`)
- Camada 1 (`components/ui/`): Button, Card, Input/Textarea/Field, Skeleton, Badge
- Camada 2: Select (Radix), Modal, Drawer, Toast (sonner), EmptyState
- Polimento por superfície: hero editorial marketplace, stacked bar admin,
  hero sóbrio console, scrolled navbar storefront

### Onda 5 — Robustez
- 5a defesa em profundidade (ownership de vehicleId, sanitização rota
  pública /api/vehicles/[id], allowlist superadmin, JWT 8h)
- 5b índices em tenant_id (11 índices, migration 0010) + `lib/platform.ts`
- 5c validação de upload (MIME + tamanho + magic bytes)
- **Pendente: 5d** rate limit + CAPTCHA (precisa Upstash + Turnstile)

### Onda 6 — Estrutura que escala
- 6a wrappers `withTenant`/`withSuperAdmin` + zod (10 endpoints migrados)
- 6b split `lib/db.ts` (997 linhas → 9 módulos em `lib/db/`)
- 6c smoke tests vitest (28 testes, 718ms)

### Console super-admin
- Mudou pra subdomínio `console.autostand.com.br`
  (em dev: `console.localhost:3000`)
- `requireConsoleHost()` em `lib/tenant.ts`
- DNS no Vercel pendente — adicionar domínio no Project Settings

### Gestão de fotos do veículo — sub-ondas A e B
- A: toolbar sempre visível (corrige bug de touch), Modal de confirmação,
  pre-check client (tipo/tamanho/cota), grid responsivo 2/3/4 cols,
  limite 15 fotos
- B: drag-and-drop com @dnd-kit (Pointer + Touch + Keyboard sensors),
  DragOverlay com ghost, persistência otimista + rollback
- **Stub de filesystem em dev**: `lib/blob.ts` salva em
  `public/uploads/dev/` quando `BLOB_READ_WRITE_TOKEN` vazio
- **Sub-ondas C+D pendentes**: compressão client, progresso por arquivo,
  lightbox, upload de logo/hero

### Storefront config — sub-onda A só (fundação, sem UI)
- Schema (migration 0011): 10 colunas novas em tenants
  (slogan, about_heading, contact_cta_title/body, facebook/youtube/tiktok/twitter_url, address)
  + nova tabela `tenant_about_items`
- DB: `lib/db/about.ts` (CRUD + reorder)
- zod: `ABOUT_ICONS` allowlist (18 ícones Lucide),
  `aboutItemInputSchema`, `tenantStorefrontSchema`
- Endpoints: `GET/POST/PATCH /api/about`, `PATCH/DELETE /api/about/[id]`
- `TENANT_WRITABLE_FIELDS` aceita os 10 novos campos

---

## Próximos passos pra fechar storefront config

### Sub-onda B — UI no admin/personalizar
Em `components/admin/PersonalizarEditor.tsx`:
- Forms novos pra slogan, about_heading, contact_cta_title/body,
  facebook/youtube/tiktok/twitter_url, address (já são aceitos pelo
  PATCH /api/personalizar — só precisa expor no formulário)
- `<AboutEditor>` novo: lista sortable de até 6 cards (usar @dnd-kit
  já instalado), cada card tem palette de ícones Lucide + título +
  descrição. Modal de edição via `<Modal>` da Camada 2.
- Persiste via os endpoints `/api/about` já existentes

### Sub-onda C — Storefront consome
Em `components/public/Storefront.tsx`:
- Substituir os 4 benefícios hardcoded por leitura de `tenant.about_items`
  (já vem do `getCurrentTenant()` — só falta o JOIN/SELECT)
- Fallback: se `about_items.length === 0`, manter os 4 atuais como default
- Renderizar redes sociais expandidas no footer (FB/YT/TikTok/X)
- Usar `tenant.contact_cta_title/body` quando preenchido
- Usar `tenant.slogan` no hero quando preenchido
- Usar `tenant.about_heading` quando preenchido

Atenção: `getCurrentTenant()` em `lib/tenant.ts` faz `db.select().from(tenants)`
— já traz as colunas novas automaticamente. Pro `about_items` precisa
chamar `listAboutItems(tenant.id)` no Storefront.

### Sub-onda D — Upload de logo e hero image
- Hoje `tenant.logo_url` e `tenant.layout_config.heroImageUrl` aceitam
  só URL no formulário
- Adicionar input file que sobe pra `/api/upload` (criar endpoint novo,
  pequeno wrapper sobre `uploadToBlob` com `folder=tenants/${id}/branding`)
- Reutilizar a infra de validação (MIME + tamanho + magic bytes)

---

## Outras frentes pendentes (priorizar com calma)

1. **5d Rate limit + CAPTCHA** — precisa criar Upstash Redis +
   Cloudflare Turnstile. Posso escrever código com env vazias
   (degrada pra no-op).
2. **Migrar handlers restantes pro withTenant**: `/api/assinar`,
   `/api/marketplace/lead`, `/api/superadmin/*`, `/api/analise`,
   `/api/inteligencia`, `/api/personalizar`. Polish técnico, invisível.
3. **Compressão client de fotos** (`browser-image-compression`) e
   lightbox no PhotoUploader.

---

## Como retomar (comandos)

```bash
# Dev server
npm run dev
# Testes (28 verde no momento)
npm test
# Build
npx next build --no-lint
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
- Em prod, configurar Vercel Blob normalmente
- Pra plugar token local: `vercel env pull .env.local --environment=development`

### Migrations pendentes em prod
- `drizzle/0010_medical_xavin.sql` — índices em tenant_id
- `drizzle/0011_new_invisible_woman.sql` — tenants colunas novas + tenant_about_items
- Aplicar via `npx drizzle-kit push` apontando pro Turso de prod ou
  rodar SQL direto no painel Turso

### Vercel DNS
- Apontar `console.autostand.com.br` pra Vercel Project no Settings →
  Domains pra ligar o console super-admin em prod

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
