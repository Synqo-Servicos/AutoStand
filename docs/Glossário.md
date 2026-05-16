---
title: Glossário
tags:
  - referencia
aliases:
  - Glossary
  - Termos
---

# Glossário

> [!abstract] Resumo
> Termos usados no projeto [[Home|AutoStand]].

### Tenant
Uma concessionária cliente. Cada tenant tem site público, painel e dados isolados. Identificado por `slug` e (opcionalmente) `custom_domain`. Ver [[Modelo de Dados#`tenants` — concessionárias clientes|tabela tenants]].

### Multi-tenancy
Arquitetura em que uma única aplicação serve vários clientes (tenants) com dados isolados. Aqui: banco compartilhado + coluna `tenant_id`. Ver [[Arquitetura#Multi-tenancy]].

### Whitelabel
Produto que cada cliente apresenta com a própria marca (cores, logo, nome, domínio), sem expor a marca da plataforma.

### Super-admin
O dono da plataforma. `role = super_admin`, sem `tenant_id`. Atua no console `/superadmin`.

### Tenant-admin
O gestor de uma concessionária. `role = tenant_admin`, vinculado a um `tenant_id`. Atua no painel `/admin`.

### Lead
Um consumidor que deixou contato pelo site (formulário "Tenho interesse") — **sem login, sem conta**. Vira um registro no CRM da concessionária e é a audiência de campanhas futuras.

### Slug
Identificador curto e estável do tenant (ex.: `pedro-ivo`). Usado no subdomínio (`pedro-ivo.autostand.com.br`) e no atalho de dev (`pedro-ivo.localhost`).

### Subdomínio
Endereço padrão de um tenant: `<slug>.autostand.com.br`. Garante o site no ar instantaneamente. Ver [[Decisões]].

### Domínio próprio (custom domain)
O domínio da concessionária (ex.: `concessionariax.com.br`), apontado para a plataforma. Recurso dos planos Pro/Premium. Campo `tenants.custom_domain`.

### Capabilities
Conjunto de funcionalidades habilitadas por [[Planos e Preços|plano]] (`customColors`, `layoutConfig`, `customDomain`, `aiAnalysis`). Definido em `lib/plans.ts`.

### Host de plataforma
Domínio que serve a própria plataforma (console super-admin), não um tenant. Configurado em `PLATFORM_HOSTS`.

### MOC (Map of Content)
Nota-índice de um vault Obsidian que mapeia e conecta as demais notas. Aqui: [[Home]].

### Sindicância de estoque
Publicar o mesmo veículo automaticamente em vários marketplaces (Webmotors, OLX, etc.) a partir de um cadastro único. Planejado no [[Milestone 3]].
