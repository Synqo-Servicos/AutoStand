# Plataforma whitelabel para concessionárias

SaaS multi-tenant que entrega site + painel de gestão para concessionárias de
veículos seminovos. Cada concessionária (tenant) tem site público, painel
administrativo e dados isolados.

> A plataforma se chama **AutoStand** (`autostand.com.br`). O nome do repositório
> (`pedro-ivo-veiculos`) é legado do primeiro cliente.

## Quick start

```bash
npm install
npm run db:setup     # migrations + seed (super-admin + concessionárias demo)
npm run dev
```

| Contexto | URL | Login |
|---|---|---|
| Console da plataforma | `localhost:3000/superadmin` | `super@plataforma.com` / `super123` |
| Concessionária Pedro Ivo | `pedro-ivo.localhost:3000` | admin: `admin@pedro-ivo.com.br` / `pedro123` |
| Concessionária demo | `demo.localhost:3000` | admin: `admin@autoprime.com` / `demo123` |

## Documentação

A documentação completa é um **vault Obsidian** na pasta [`docs/`](./docs/Home.md) —
abra `docs/` no Obsidian, ou comece pelo MOC em [`docs/Home.md`](./docs/Home.md).

Notas principais: `Visão Geral`, `Arquitetura`, `Modelo de Dados`, `Planos e Preços`,
`Roadmap` (+ `Milestone 1/2/3`), `Decisões`, `Desenvolvimento`, `Glossário`.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind 4 · Drizzle ORM · libSQL/Turso ·
NextAuth 5 · Vercel Blob.
