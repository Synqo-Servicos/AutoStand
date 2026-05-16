---
title: Milestone 1 — Multi-tenancy
tags:
  - planejamento
  - milestone
status: concluído
aliases:
  - M1
---

# Milestone 1 — Multi-tenancy

> [!success] Status: concluído
> Transformou o projeto de site single-tenant ("Pedro Ivo Veículos") num SaaS whitelabel multi-tenant. Entregue e verificado (build passa, multi-tenancy testada).

## O que foi entregue

- **Dados** — migração de SQLite local para libSQL/Drizzle; schema multi-tenant; migrations; seed.
- **Resolução de tenant** — `lib/tenant.ts`, por header `Host`. Ver [[Arquitetura#Multi-tenancy]].
- **Isolamento** — auth com `tenant_id` + `role` no JWT; todas as rotas e páginas escopadas por tenant.
- **Console super-admin** — `/superadmin`: dashboard da plataforma, CRUD de concessionárias, criação do admin de cada uma.
- **Branding dinâmico** — site público 100% whitelabel (cores via CSS vars, contatos do banco). `TenantContext` + `useTenant()`. Ver [[Arquitetura#Branding dinâmico]].
- **CRM de leads** — formulário "Tenho interesse" no site → `/admin/leads`.

## Resultado

O sistema já é um SaaS multi-tenant funcional: o super-admin cadastra concessionárias e cada uma tem site + painel isolados, com branding próprio e CRM de leads.

Foram criadas duas concessionárias de exemplo — ver [[Desenvolvimento#Acessando os contextos em dev]]:
- **Pedro Ivo Veículos** — o primeiro cliente.
- **AutoPrime Seminovos** (`demo`) — vitrine de apresentação, com identidade visual distinta.

Detalhes técnicos do que foi construído: [[Arquitetura]] e [[Modelo de Dados]].
