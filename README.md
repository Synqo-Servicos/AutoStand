# AutoStand

[![CI](https://github.com/Ulpio/AutoStand/actions/workflows/test.yml/badge.svg)](https://github.com/Ulpio/AutoStand/actions/workflows/test.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-RDS-4169E1?logo=postgresql&logoColor=white)

**Plataforma whitelabel multi-tenant para revendas de veículos seminovos.**

De um único app Next.js, cada revenda (tenant) recebe uma vitrine pública com a própria marca, um painel de gestão completo e presença no marketplace agregado do AutoStand — com cobrança recorrente e recursos de IA. Os dados de cada loja são isolados pela aplicação.

> [!NOTE]
> O produto se chama **AutoStand** (`autostand.com.br`). O nome do repositório (`pedro-ivo-veiculos`) é legado do primeiro cliente.

## Índice

- [Visão geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Começando](#começando)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Scripts](#scripts)
- [Testes](#testes)
- [Deploy e ambientes](#deploy-e-ambientes)
- [Documentação](#documentação)
- [Licença](#licença)

## Visão geral

O sistema serve **quatro superfícies** a partir da mesma base de código, diferenciadas pelo `Host` da requisição:

| Superfície | Onde | Para quem |
|---|---|---|
| **Marketplace / Plataforma** | `autostand.com.br` | Compradores (catálogo agregado) e marketing |
| **Vitrine da loja** | `<loja>.autostand.com.br` ou domínio próprio | Compradores (storefront whitelabel da revenda) |
| **Painel da loja** | `/admin` (em um host de tenant) | Administrador da concessionária |
| **Console da plataforma** | `console.autostand.com.br/superadmin` | Dono da plataforma (superadmin) |

A multi-tenancy usa **schema único** no PostgreSQL: toda linha pertencente a uma loja carrega `tenant_id`, e o isolamento é garantido na camada de acesso a dados (`WHERE tenant_id = ?`). O marketplace é o único leitor cross-tenant autorizado.

## Funcionalidades

- **Vitrine whitelabel** — cores, logo e domínio próprio por loja; SEO (sitemap/robots).
- **Painel da revenda** — estoque de veículos, leads (funil), vendedores e comissões, financeiro, transações, documentos em PDF, assinatura.
- **Marketplace** — catálogo agregado cross-tenant com captura de leads.
- **Console superadmin** — gestão de tenants, parceiros (indicação) e cupons.
- **Pagamentos** — assinatura recorrente via Mercado Pago (Preapproval) com cupons.
- **IA** — geração de legendas para Instagram, análise de vitrine e inteligência de demanda (Anthropic Claude).

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, `output: standalone`) · React 19 |
| Linguagem | TypeScript (strict) |
| Estilo | Tailwind CSS v4 |
| Banco de dados | PostgreSQL (Amazon RDS) · Drizzle ORM |
| Autenticação | Auth.js / NextAuth v5 (Credentials, JWT) |
| Pagamentos | Mercado Pago (assinatura Preapproval) |
| IA | Vercel AI SDK + Anthropic Claude |
| Mídia | AWS S3 + CloudFront (fallback em filesystem no dev) |
| Rate limiting | Upstash Redis |
| Antibot | Cloudflare Turnstile |
| Documentos | `@react-pdf/renderer` |
| Testes | Vitest |

## Começando

### Pré-requisitos

- Node.js 22+
- PostgreSQL (local ou remoto)

### Instalação

```bash
npm install

# crie um .env.local com, no mínimo:
#   DATABASE_URL=postgres://user:pass@localhost:5432/autostand
#   AUTH_SECRET=<openssl rand -base64 32>
# (integrações como S3, Upstash, Turnstile, Mercado Pago e IA ficam no-op sem suas envs)

npm run db:setup     # migrations + seed (super-admin + lojas demo)
npm run dev
```

### Acessos de desenvolvimento

Credenciais do seed local (apenas dev — nunca usadas em produção):

| Contexto | URL | Login |
|---|---|---|
| Console da plataforma | `localhost:3000/superadmin` | `super@plataforma.com` / `super123` |
| Loja Pedro Ivo | `pedro-ivo.localhost:3000` | `admin@pedro-ivo.com.br` / `pedro123` |
| Loja demo | `demo.localhost:3000` | `admin@autoprime.com` / `demo123` |

## Estrutura do projeto

```
app/                  # Next.js App Router
  (public)/           # vitrine pública + marketplace
  admin/(protected)/  # painel da concessionária (tenant)
  superadmin/(panel)/ # console da plataforma
  api/                # route handlers
components/           # UI por área (admin, public, marketplace, ui, pdf…)
lib/                  # domínio (auth, checkout, plans, ai, pdf, platform…)
  db/                # camada de acesso a dados (Drizzle), 1 módulo por entidade
  schema.ts          # schema do banco
drizzle/             # migrations geradas
scripts/             # migrate, seed e manutenção
tests/               # Vitest
types/               # tipos compartilhados
docs/                # vault Obsidian (documentação do projeto)
```

## Scripts

| Script | Ação |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção (standalone) |
| `npm start` | Sobe o build de produção |
| `npm run lint` | ESLint |
| `npm test` | Testes (Vitest) |
| `npm run db:generate` | Gera SQL de migration a partir do schema |
| `npm run db:migrate` | Aplica as migrations |
| `npm run db:seed` | Popula super-admin + lojas demo (aborta em produção) |
| `npm run db:setup` | `db:migrate` + `db:seed` |

## Testes

```bash
npm test
```

Suíte em Vitest cobrindo funções puras e metadados de schema (checkout, cupons, comissão de vendedor, resolução de host/tenant, marketplace e a rota `/api/health`). O `tsc --noEmit` roda no CI como rede de segurança de tipos.

## Deploy e ambientes

CI/CD via **GitHub Actions** para **AWS ECS Fargate** (atrás de um ALB, imagens no ECR):

- **Homologação** — deploy automático no push para `main` (`deploy-homolog.yml`).
- **Produção** — deploy manual (`workflow_dispatch` em `deploy-production.yml`).
- **CI** — `tsc` + testes em PRs para `main` (`test.yml`).

Fluxo recomendado: abrir PR → CI → merge para `main` → homolog sobe automático → validar → disparar prod manualmente.

> [!IMPORTANT]
> As **migrations não rodam no deploy** — execute `npm run db:migrate` por ambiente quando o schema mudar.

## Documentação

A documentação completa é um **vault Obsidian** em [`docs/`](./docs/Home.md) — abra a pasta `docs/` no Obsidian ou comece pelo MOC em [`docs/Home.md`](./docs/Home.md).

Notas principais: `Visão Geral`, `Arquitetura`, `Modelo de Dados`, `Design System`, `Planos e Preços`, `Roadmap` (+ `Milestone 1–5`), `Decisões`, `Desenvolvimento`, `Onboarding`, `Glossário`.

## Licença

Projeto proprietário — todos os direitos reservados.
