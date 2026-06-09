# Handoff — estado do projeto

**Última atualização:** 2026-06-09
**Último commit:** `dd909fc` (fix(docker): revert curl install — health check migrated to wget in task def)

> Pega aqui pra retomar onde paramos sem precisar relembrar tudo.
> Vê também `docs/SPEC-evolucao.md`, `docs/SPEC-design-system.md`,
> `docs/Ideias.md` (backlog completo).

---

## Estado atual — PRODUÇÃO FUNCIONANDO ✅

O billing com Mercado Pago está operacional em produção. O fluxo E2E foi validado
em 2026-06-09: `/assinar` → cria tenant → redireciona para checkout MP de produção
(plano real, preço real) → webhook ativa o tenant ao confirmar pagamento.

### O que foi feito na sessão de 2026-06-09

1. **Credenciais MP de produção configuradas** — 3 planos criados via API e secrets
   atualizados no GitHub env `production`:
   - `MERCADOPAGO_ACCESS_TOKEN` ✅
   - `MERCADOPAGO_WEBHOOK_SECRET` ✅
   - `MERCADOPAGO_PLAN_BASICO` → `98e8b29d50a2420aa02aca094e6fd416` (R$ 169,90/mês)
   - `MERCADOPAGO_PLAN_PRO` → `15d14d9dcad64b12a57460f0f404ee6d` (R$ 349,90/mês)
   - `MERCADOPAGO_PLAN_PREMIUM` → `ee0413ecc552491ea392a23f90050844` (R$ 499,90/mês)

2. **Fixes de checkout mergeados** (branch `homolog` → `main`):
   - `lib/checkout.ts` — substituído criação de PreApproval via API (exigia `card_token_id`)
     por redirect direto para `mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=...&external_reference=<tenant_id>`
   - `app/api/webhooks/mercadopago/route.ts` — corrigido: evento `authorized` agora
     também atualiza `status='active'` além de `subscription_status`. Sem isso o
     tenant ficava suspenso mesmo com pagamento confirmado.

3. **Fix de infra: health check do ECS** — a imagem Alpine não tem `curl` por padrão.
   O health check foi migrado para `wget` diretamente na task definition (revisão :8),
   que é herdada por todos os deploys futuros. O Dockerfile ficou sem curl.

---

## Mercado Pago — OPERACIONAL EM PRODUÇÃO

- **Webhook URL:** `https://autostand.com.br/api/webhooks/mercadopago` — evento `preapproval`
- **Checkout:** redirect para `mercadopago.com.br/subscriptions/checkout` com `preapproval_plan_id` + `external_reference`
- **Ativação:** webhook recebe `authorized` → atualiza `status='active'` + `subscription_status='active'` + `mp_subscription_id`
- **Suspensão:** `paused`/`cancelled` → `status='suspended'`
- **Conta MP:** SYNQO SERVICOS LTDA (razão social da conta do usuário)

---

## Migração Vercel → AWS — CONCLUÍDA

A migração está completa. O DNS de `autostand.com.br` aponta 100% para o
CloudFront/AWS. A Vercel pode ser deletada — não recebe mais tráfego.

### Arquitetura em produção

```
Usuário
  └── CloudFront A (E2ZAXVU5GRBGKB) — autostand.com.br + *.autostand.com.br
        └── ALB autostand-alb (sa-east-1)
              └── ECS Fargate — cluster: autostand, service: autostand-web

      CloudFront B (E1FMGN9TYY08T) — cdn.autostand.com.br
        └── S3 bucket: autostand-uploads (sa-east-1)
```

### AWS
- **Profile local:** `autostand` | **Account:** `507099297746`
- **ECR:** `507099297746.dkr.ecr.sa-east-1.amazonaws.com/autostand`
- **IAM OIDC Role:** `arn:aws:iam::507099297746:role/github-actions-autostand`
- **Certificado ACM:** `arn:aws:acm:us-east-1:507099297746:certificate/743a7113-ab36-434b-8e9e-3f0acf6a559e` — ISSUED, wildcard `*.autostand.com.br`
- **Hosted Zone Route 53:** `Z0112278247WDT5RPBURR`
- **ECS task definition ativa:** `autostand:9` (health check: `wget -qO- http://localhost:3000/api/health`)

### Rotas funcionando em produção
| URL | Status |
|-----|--------|
| `https://autostand.com.br/` | 200 — landing page |
| `https://autostand.com.br/assinar` | 200 — cadastro de tenants |
| `https://console.autostand.com.br/` | 200 — painel admin |
| `https://autostand.com.br/api/health` | 200 |
| `https://cdn.autostand.com.br/` | CDN S3 |

---

## Banco de dados Turso

- **URL prod:** `libsql://database-beige-bell-vercel-icfg-xfqaomkkq5ftkrxfe8fixajw.aws-us-east-1.turso.io`
- **Migrations aplicadas:** 0000–0012
- Para rodar migrations contra produção: `DATABASE_URL=<url> DATABASE_AUTH_TOKEN=<token> npx drizzle-kit migrate`
  ⚠️ O drizzle.config.ts lê `DATABASE_URL`, não `TURSO_DATABASE_URL`

---

## CI/CD — GitHub Actions

- **Repo:** `Ulpio/AutoStand`
- **Workflow:** `.github/workflows/deploy.yml` — dispara em `push: main` e `workflow_dispatch`
- **Workflow homolog:** `.github/workflows/deploy-homolog.yml` — dispara em `push: homolog`
- **Environment:** `production` — todos os secrets aqui
- **Fluxo:** test → build Docker → push ECR → render task def (herda a atual, só troca imagem) → deploy ECS

### Secrets no GitHub environment `production`
| Secret | Estado |
|--------|--------|
| `AWS_ROLE_ARN` | ✅ configurado |
| `AUTH_SECRET` | ✅ configurado |
| `PLATFORM_DOMAIN` | ✅ `autostand.com.br` |
| `PLATFORM_HOSTS` | ✅ `autostand.com.br` |
| `TURSO_DATABASE_URL` | ✅ configurado |
| `TURSO_AUTH_TOKEN` | ✅ configurado |
| `ANTHROPIC_API_KEY` | ✅ configurado |
| `AI_MODEL` | ✅ `claude-haiku-4-5` |
| `AWS_S3_BUCKET` | ✅ `autostand-uploads` |
| `AWS_S3_REGION` | ✅ `sa-east-1` |
| `CDN_URL` | ✅ `https://cdn.autostand.com.br` |
| `MERCADOPAGO_ACCESS_TOKEN` | ✅ produção |
| `MERCADOPAGO_WEBHOOK_SECRET` | ✅ produção |
| `MERCADOPAGO_PLAN_BASICO` | ✅ `98e8b29d50a2420aa02aca094e6fd416` |
| `MERCADOPAGO_PLAN_PRO` | ✅ `15d14d9dcad64b12a57460f0f404ee6d` |
| `MERCADOPAGO_PLAN_PREMIUM` | ✅ `ee0413ecc552491ea392a23f90050844` |
| `UPSTASH_REDIS_REST_URL` | vazio (rate limit desabilitado) |
| `UPSTASH_REDIS_REST_TOKEN` | vazio |
| `TURNSTILE_SECRET_KEY` | vazio (CAPTCHA desabilitado) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | vazio |

---

## Sistema de Cupons — IMPLEMENTADO ✅

Migration 0013 aplicada (pendente deploy). Commits: `feat(schema)` → `feat(db)` → `feat(checkout)` → `feat(api) ×3` → `feat(ui)`.

### O que foi implementado
- **`lib/schema.ts`** — tabela `coupons` + `tenants.coupon_id`
- **`drizzle/0013_coupons.sql`** — migration pronta (rodar contra produção)
- **`lib/db/coupons.ts`** — `getCouponByCode`, `createCoupon`, `incrementCouponUse`, `isCouponValid`
- **`lib/checkout.ts`** — plano MP descontado on-the-fly via `PreApprovalPlan.create()`
- **`GET /api/cupons/validate`** — validação pública com preview
- **`GET+POST /api/superadmin/cupons`** — gestão de cupons
- **`/superadmin/cupons`** + **`/superadmin/cupons/novo`** — UI superadmin
- **`SignupForm`** — campo de cupom com validação on-blur e preview
- **`POST /api/assinar`** — valida, usa, e salva `coupon_id` no tenant

### Para ativar em produção
```bash
# 1. Deploy (já há commits novos no main)
gh workflow run deploy.yml --repo Ulpio/AutoStand --ref main

# 2. Rodar migration contra Turso produção
DATABASE_URL=<url> DATABASE_AUTH_TOKEN=<token> npx drizzle-kit migrate
```

---

## Próxima feature sugerida: Sistema de Cupons (spec original mantida para referência)

### Contexto
Vendedores visitam concessionárias e podem negociar desconto na assinatura
(ex: primeiro mês grátis, 10% de desconto). O superadmin (ou parceiros vinculados)
gera um cupom no console que o vendedor repassa ao prospect. O cupom é aplicado
no momento do cadastro em `/assinar`.

### Decisões tomadas
- **MP gerencia o desconto:** criamos um plano MP com o preço já reduzido on-the-fly
  ao usar o cupom. Não há controle manual.
- **Quem gera:** superadmin + parceiros (superadmin pode associar cupom a um parceiro
  para rastreamento de atribuição).
- **Uso único por padrão** (`max_uses = 1`), configurável.

### Tipos de desconto suportados
| Tipo | Comportamento no MP |
|---|---|
| `percentage` | Plano MP com `transaction_amount = preço × (1 - %)` recorrente |
| `fixed` | Plano MP com `transaction_amount = preço - valor` recorrente |
| `free_month` | Plano MP com `free_trial: { frequency: 1, frequency_type: "months" }` |

### Schema (migration 0013 — ainda não implementada)
```ts
coupons: {
  id, code (unique), description,
  discount_type: 'percentage' | 'fixed' | 'free_month',
  discount_value: number | null,  // null para free_month
  max_uses: number,               // default 1
  used_count: number,             // default 0
  expires_at: string | null,
  created_by: FK users.id,
  partner_id: FK partners.id | null,  // atribuição opcional
  created_at
}
// tenants ganha: coupon_id FK coupons.id | null
```

### O que implementar
1. **Migration 0013** — tabela `coupons` + coluna `tenants.coupon_id`
2. **`lib/db/coupons.ts`** — CRUD: `getCouponByCode`, `createCoupon`, `incrementCouponUse`, `listCoupons`
3. **`lib/checkout.ts`** — `createCheckoutSession` recebe `coupon | null`, cria plano MP descontado on-the-fly via API quando há cupom
4. **`GET /api/cupons/validate?code=XXX&plan=basico`** — valida cupom e retorna preview do desconto (público)
5. **`/api/superadmin/cupons`** — GET (lista) + POST (cria)
6. **`/superadmin/cupons`** — página: lista + modal "Novo cupom" (código auto/custom, tipo, valor, max usos, validade, parceiro opcional)
7. **`/assinar`** — campo "Código de cupom" opcional com validação on-blur e preview do desconto antes do submit
8. **`/api/assinar`** — validar cupom, passar para `createCheckoutSession`, incrementar uso, salvar `coupon_id` no tenant

### Notas de implementação
- Criar plano MP on-the-fly: mesma estrutura dos planos base, só com `transaction_amount` diferente ou `free_trial`
- `back_url` do plano descontado = `https://autostand.com.br/admin/assinatura`
- O `external_reference` continua sendo `String(tenant.id)` — o webhook funciona igual
- Cupom é marcado como usado no momento do submit (não na confirmação do pagamento) para evitar reuso por abandono
- Parceiros: página `/superadmin/parceiros/[id]` deve listar cupons do parceiro e suas conversões

---

## O que estava pronto antes da sessão de 2026-06-09

### Onda 1-4 — Design system completo
### Onda 5 — Robustez (rate limit, CAPTCHA no-op, índices, validação upload)
### Onda 6 — Estrutura (wrappers, split lib/db/, 28 smoke tests)
### Storefront config — migration 0011, editor no admin
### Gestão de fotos — drag-and-drop, compressão, lightbox, S3
### Mercado Pago — checkout + webhook + schema (migration 0012)

---

## Como retomar

```bash
npm run dev        # dev server
npm test           # 28 testes
npx next build     # build

# Redeploy manual sem commit:
gh workflow run deploy.yml --repo Ulpio/AutoStand --ref main
```

### Credenciais de teste (dev local)
- Tenants: `admin@autoprime.com`/`demo123`, `admin@garagem082.com.br`/`garagem123`
- Super-admin: `super@plataforma.com`/`super123` (em `console.localhost:3000/superadmin/login`)

### URLs locais
- Marketplace: `http://localhost:3000`
- Storefront: `http://<slug>.localhost:3000`
- Admin: `http://<slug>.localhost:3000/admin/login`
- Console: `http://console.localhost:3000/superadmin/login`

---

## Decisões de arquitetura relevantes

- `PLATFORM_HOSTS` deve conter só `autostand.com.br` — `isPlatformHost()` já cobre `console.*` automaticamente
- `drizzle.config.ts` usa `DATABASE_URL` (não `TURSO_DATABASE_URL`) — importante na hora de rodar migrations
- Rate limit usa 1º hop do `x-forwarded-for` — aceitável atrás do CloudFront/ALB que já sanitiza o header
- Blobs S3: upload via `lib/storage.ts`, CDN via `cdn.autostand.com.br`
- O checkout MP usa `external_reference: String(tenant.id)` para vincular assinatura ao tenant
- ECS health check: `wget -qO- http://localhost:3000/api/health` — NÃO usar curl (não está no Alpine)
- Task definition é baixada sem versão no CI (`--task-definition autostand`) → sempre pega a mais recente
