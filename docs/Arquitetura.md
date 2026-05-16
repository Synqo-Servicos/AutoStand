---
title: Arquitetura
tags:
  - tecnico
aliases:
  - Architecture
---

# Arquitetura

> [!abstract] Resumo
> Aplicação **Next.js 16 (App Router)** única, multi-tenant por `tenant_id`, com resolução de tenant por header `Host`. Banco libSQL/Turso via Drizzle ORM.

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19 |
| Linguagem | TypeScript (strict) |
| Estilo | Tailwind CSS 4 |
| Banco | libSQL / Turso (SQLite na nuvem) |
| ORM | Drizzle ORM + drizzle-kit |
| Auth | NextAuth 5 (Credentials, sessão JWT) |
| Upload | Vercel Blob |
| Deploy | Vercel |

## Multi-tenancy

> [!info] Estratégia
> **Shared database, shared schema.** Todas as concessionárias dividem o mesmo banco; cada linha de dado carrega `tenant_id`. O isolamento é garantido em código — toda função de acesso a dados recebe e filtra por `tenant_id`.

**Resolução do tenant** (`lib/tenant.ts`), por header `Host`:

1. Host da plataforma (`PLATFORM_HOSTS`) → sem tenant; área `/superadmin`.
2. `<slug>.localhost` → resolve por **slug** (atalho de dev).
3. Outro host → resolve pelo **domínio próprio** (`tenants.custom_domain`).

Funções: `getCurrentTenant()`, `requireTenant()` (dispara 404), `isPlatformHost()`.

> [!warning] De onde vem o `tenant_id`
> - Páginas/rotas **públicas** → do host (`getCurrentTenant()`).
> - Páginas/rotas **autenticadas** → da **sessão** do usuário (`getApiTenantId()`), que é a fonte de verdade de quem está agindo.
> - Rotas **super-admin** → exigem `isSuperAdmin()`, operam cross-tenant.

Ver também: [[Modelo de Dados]].

## Autenticação

- NextAuth 5, provider **Credentials** (email + senha), sessão **JWT**.
- O JWT carrega `id`, `tenantId` e `role` (`super_admin` | `tenant_admin`).
- Login único — o mesmo `/api/auth` autentica os dois tipos; o `role` diferencia.
- Gating é feito **nos layouts**: `admin/(protected)/layout.tsx` exige `tenant_admin` do tenant do host; `superadmin/(panel)/layout.tsx` exige `super_admin` em host de plataforma.

## Branding dinâmico

O site público é whitelabel — nada hardcoded.

- `components/TenantContext.tsx` — `<TenantProvider>` + hook `useTenant()`.
- **Tema via CSS variables** — o layout `(public)` injeta `--brand-primary`, `--brand-primary-d`, `--brand-primary-l`, `--brand-accent`, `--brand-accent-d` a partir das cores do tenant. Componentes usam `bg-[var(--brand-accent)]` etc.
- `lib/constants.ts` guarda só enums de domínio (status, combustíveis); branding vem do banco.

## Estrutura de pastas

```
app/
  (public)/       Site público do tenant (layout injeta tenant + tema)
  admin/          Login + painel do tenant (protected)
  superadmin/     Login + console da plataforma (panel)
  api/            vehicles, transactions, dashboard, leads, superadmin/tenants, auth
components/  public/ · admin/ · superadmin/ · TenantContext.tsx
lib/         db.ts · schema.ts · tenant.ts · auth.ts · plans.ts · layout.ts · blob.ts
drizzle/     migrations geradas
scripts/     migrate.ts · seed.ts
docs/        este vault
```

## Rotas

**Públicas:** `/`, `/veiculos/[id]`
**Tenant admin:** `/admin/login`, `/admin/dashboard`, `/admin/veiculos[/novo|/[id]]`, `/admin/transacoes`, `/admin/leads`
**Super-admin:** `/superadmin/login`, `/superadmin/dashboard`, `/superadmin/tenants[/novo|/[id]]`
**API:** `vehicles`, `transactions`, `dashboard`, `leads`, `superadmin/tenants`, `auth`

Convenções de código em [[Desenvolvimento#Convenções de código]].
