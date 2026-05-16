---
title: Desenvolvimento
tags:
  - tecnico
  - operacao
aliases:
  - Dev
  - Setup
  - Como Rodar
---

# Desenvolvimento

> [!abstract] Resumo
> Como subir o [[Home|AutoStand]] localmente, scripts disponíveis, convenções de código e o caminho de deploy.

## Subir o projeto

```bash
npm install
npm run db:setup     # migrations + seed (super-admin + concessionárias demo)
npm run dev          # http://localhost:3000
```

O banco de dev é um arquivo local libSQL: `local.db` (ignorado pelo git).

## Scripts npm

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento. |
| `npm run build` | Build de produção. |
| `npm run db:generate` | Gera migration a partir de `lib/schema.ts`. |
| `npm run db:migrate` | Aplica migrations pendentes. |
| `npm run db:seed` | Popula o banco (idempotente). |
| `npm run db:setup` | `db:migrate` + `db:seed`. |

## Acessando os contextos em dev

O multi-tenancy resolve pelo `Host`; em dev usa-se `<slug>.localhost` (os navegadores resolvem para 127.0.0.1 sozinhos).

| Contexto | URL | Login |
|---|---|---|
| Console da plataforma | `localhost:3000/superadmin` | `super@plataforma.com` / `super123` |
| Concessionária "Pedro Ivo" | `pedro-ivo.localhost:3000` | `admin@pedro-ivo.com.br` / `pedro123` |
| Concessionária demo "AutoPrime" | `demo.localhost:3000` | `admin@autoprime.com` / `demo123` |

> [!tip] Concessionária demo
> A `demo` (AutoPrime Seminovos) tem identidade visual distinta e existe para servir de **vitrine de apresentação** a prospects.

## Variáveis de ambiente (`.env.local`)

```
DATABASE_URL=file:local.db     # dev: arquivo. prod: libsql://... (Turso)
DATABASE_AUTH_TOKEN=           # token da Turso (prod)
AUTH_SECRET=...                # segredo do NextAuth
AUTH_URL=http://localhost:3000
BLOB_READ_WRITE_TOKEN=         # Vercel Blob (upload de fotos)
PLATFORM_HOSTS=localhost,127.0.0.1,app.localhost
ANTHROPIC_API_KEY=             # análise de IA (Fase 8) — chave da Anthropic
AI_MODEL=                      # opcional — modelo de IA (padrão: claude-haiku-4-5)
```

O [[Milestone 2]] adiciona variáveis do provedor de pagamento na Fase 2.

## Convenções de código

> [!important] Regras invioláveis
> - **Sempre filtrar por tenant.** Toda leitura/escrita de dado de tenant passa por uma função de `lib/db.ts` que recebe `tenantId`.
> - `tenantId` vem da **sessão** em rotas autenticadas, do **host** em rotas públicas.
> - **snake_case** em colunas, tipos e schema Drizzle.
> - **Dinheiro em centavos** (inteiros).
> - **Branding nunca hardcoded** — vem do `TenantRow`; no site público, usar as CSS vars `--brand-*`.
> - **Tema certo no lugar certo** — plataforma usa os tokens `--color-*`; site público usa `--brand-*`. Ver [[Design System]].
> - UI em **português (pt-BR)**.

### Adicionar uma feature com dado novo de tenant

1. Coluna/tabela em `lib/schema.ts` (com `tenant_id` se for de tenant).
2. `npm run db:generate` → revisar a migration → `npm run db:migrate`.
3. Funções de acesso em `lib/db.ts`, sempre recebendo `tenantId`.
4. Rota em `app/api/...` (tenant pela sessão ou pelo host).
5. Consumir nas páginas/componentes; atualizar o seed se útil.

## Deploy (Vercel)

1. Provisionar **Turso**; setar `DATABASE_URL` + `DATABASE_AUTH_TOKEN`.
2. Setar `PLATFORM_HOSTS` (= `autostand.com.br`), `AUTH_SECRET`, `BLOB_READ_WRITE_TOKEN`.
3. `npm run db:migrate` contra a Turso + criar o super-admin.
4. Adicionar `autostand.com.br` **e** o wildcard `*.autostand.com.br` no projeto Vercel; delegar os nameservers do domínio à Vercel (habilita o subdomínio automático).

> [!note] Sem suíte de testes
> O projeto ainda não tem testes automatizados.
