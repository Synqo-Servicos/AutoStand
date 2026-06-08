# Handoff — estado do projeto

**Última atualização:** 2026-06-08
**Último commit:** `ff2298a` (ci: add workflow_dispatch trigger to deploy workflow)

> Pega aqui pra retomar onde paramos sem precisar relembrar tudo.
> Vê também `docs/SPEC-evolucao.md`, `docs/SPEC-design-system.md`,
> `docs/Ideias.md` (backlog completo).

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
- **Migrations aplicadas:** 0000–0012 (todas — 0010/0011 foram aplicadas via HTTP API nesta sessão)
- Para rodar migrations contra produção: `DATABASE_URL=<url> DATABASE_AUTH_TOKEN=<token> npx drizzle-kit migrate`
  ⚠️ O drizzle.config.ts lê `DATABASE_URL`, não `TURSO_DATABASE_URL`

---

## CI/CD — GitHub Actions

- **Repo:** `Ulpio/AutoStand`
- **Workflow:** `.github/workflows/deploy.yml` — dispara em `push: main` e `workflow_dispatch`
- **Environment:** `production` — todos os secrets aqui
- **Fluxo:** test → build Docker → push ECR → render task def → deploy ECS (aguarda estabilidade)

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
| `MERCADOPAGO_ACCESS_TOKEN` | ⚠️ **MOCK** — substituir pelo real |
| `MERCADOPAGO_WEBHOOK_SECRET` | ⚠️ **MOCK** — substituir pelo real |
| `MERCADOPAGO_PLAN_BASICO` | ⚠️ **MOCK** — substituir pelo ID real |
| `MERCADOPAGO_PLAN_PRO` | ⚠️ **MOCK** — substituir pelo ID real |
| `MERCADOPAGO_PLAN_PREMIUM` | ⚠️ **MOCK** — substituir pelo ID real |
| `UPSTASH_REDIS_REST_URL` | vazio (rate limit desabilitado) |
| `UPSTASH_REDIS_REST_TOKEN` | vazio |
| `TURNSTILE_SECRET_KEY` | vazio (CAPTCHA desabilitado) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | vazio |

---

## Mercado Pago — implementado, credenciais mock

O billing está implementado e testado. Faltam só as credenciais de produção.

**Bloqueio atual:** criação de aplicação no painel MP falhando com erro de
reCAPTCHA (score 0.5 abaixo do threshold). Tentativas:
- Chrome sem extensões/VPN para melhorar o score
- Suporte MP com trace ID `DXT400-UUYJNU1XQSUW`

**Quando tiver `MERCADOPAGO_ACCESS_TOKEN` de produção:**

1. Criar 3 planos via API:
```bash
MP_TOKEN="<access_token_producao>"

# Básico — R$ 169,90/mês
curl -X POST https://api.mercadopago.com/preapproval_plan \
  -H "Authorization: Bearer $MP_TOKEN" -H "Content-Type: application/json" \
  -d '{"reason":"AutoStand Básico","auto_recurring":{"frequency":1,"frequency_type":"months","transaction_amount":169.90,"currency_id":"BRL"},"back_url":"https://autostand.com.br/admin/assinatura","status":"active"}'

# Pro — R$ 349,90/mês (transaction_amount: 349.90, reason: "AutoStand Pro")
# Premium — R$ 499,90/mês (transaction_amount: 499.90, reason: "AutoStand Premium")
```

2. Atualizar secrets no GitHub: `MERCADOPAGO_PLAN_BASICO/PRO/PREMIUM` com os `id` retornados
3. Atualizar `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET`
4. No painel MP: configurar webhook → `https://autostand.com.br/api/webhooks/mercadopago` — evento: `preapproval`
5. Fazer push vazio para triggar redeploy: `git commit --allow-empty -m "chore: redeploy" && git push`

---

## O que estava pronto antes desta sessão

### Onda 1-4 — Design system completo
- Tokens, componentes UI, polimento por superfície

### Onda 5 — Robustez
- Defesa em profundidade, índices, validação de upload, rate limit + CAPTCHA (no-op sem envs)

### Onda 6 — Estrutura
- Wrappers `withTenant`/`withSuperAdmin`, split `lib/db/`, smoke tests (28 testes)

### Storefront config — completa
- Schema migration 0011, editor no admin, storefront consome tudo

### Gestão de fotos — completa
- Drag-and-drop, compressão, lightbox, upload logo/hero, cleanup de blobs

### Mercado Pago (código completo)
- `lib/checkout.ts` — cria PreApproval no MP
- `app/api/webhooks/mercadopago/route.ts` — recebe eventos, ativa tenant
- `app/api/assinatura/route.ts` — redireciona para gestão do cartão no MP
- `/admin/assinatura` — mostra plano, status, botão "Gerenciar pagamento" (ativo quando mp_subscription_id existe)
- Schema `mp_subscription_id` em tenants

---

## Próximos passos

1. **Desbloqueio MP** — resolver acesso ao painel e criar planos reais
2. **Teste E2E** — cadastrar tenant via `/assinar`, validar checkout → webhook → ativação
3. **Upstash + Turnstile** — configurar em prod quando tiver usuários reais
4. **Vercel** — pode deletar o projeto (opcional)
5. **Milestone 3** — automação WhatsApp, integrações FIPE, multi-usuário por tenant

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
