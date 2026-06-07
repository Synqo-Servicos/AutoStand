# Design: Migração Vercel → AWS + Mercado Pago

**Data:** 2026-06-07  
**Projeto:** AutoStand  
**Status:** Aprovado

---

## Contexto

O AutoStand é um SaaS multi-tenant para concessionárias de veículos, construído em Next.js App Router com Turso (libSQL) como banco de dados. Atualmente hospedado na Vercel com `@vercel/blob` para armazenamento de arquivos.

**Motivações para migração:**
- CI/CD sem visibilidade — pipeline implícito do Vercel, sem versionamento
- Vendor lock-in — `@vercel/blob`, DNS e routing acoplados à Vercel
- Custo imprevisível — modelo de cobrança por bandwidth/execução da Vercel

**Objetivos:**
- Pipeline CI/CD explícito, versionado no repositório via GitHub Actions
- Zero dependências de fornecedor específico na camada de infra
- Custo fixo e previsível na AWS
- Implementar billing recorrente via Mercado Pago (substitui seam do Stripe)

---

## Arquitetura Alvo

### Serviços AWS

| Serviço | Papel |
|---|---|
| ECS Fargate | Roda o container Next.js (0.5 vCPU / 1 GB RAM inicial) |
| ECR | Registro de imagens Docker |
| ALB | Load balancer com SSL termination |
| CloudFront | CDN na frente do ALB + origin separada para S3 |
| S3 | Armazenamento de arquivos (substitui `@vercel/blob`) |
| Route 53 | DNS: `autostand.com.br` + wildcard `*.autostand.com.br` |
| ACM | Certificado SSL wildcard gratuito, auto-renovável |
| CloudWatch | Logs e alertas |

### Serviços mantidos (cloud-agnósticos)

| Serviço | Papel |
|---|---|
| Turso (libSQL) | Banco de dados remoto |
| Upstash Redis | Rate limiting |
| Cloudflare Turnstile | CAPTCHA |

### Fluxo de request

```
DNS (Route 53)
  └─ *.autostand.com.br → CloudFront
       └─ ALB (SSL termination, preserva Host header)
            └─ ECS Fargate (Next.js :3000)
                 ├─ DB: Turso
                 └─ Storage: S3 (via CloudFront cdn.autostand.com.br)
```

O roteamento multi-tenant (`lib/tenant.ts`) lê o `Host` header preservado pelo ALB — zero mudança de código nessa camada.

### Domínios

| Domínio | Destino |
|---|---|
| `autostand.com.br` | Landing + `/assinar` |
| `*.autostand.com.br` | Storefront de cada tenant |
| `console.autostand.com.br` | Painel super-admin |
| `cdn.autostand.com.br` | Assets S3 via CloudFront |
| `www.autostand.com.br` | Redirect para apex (já em `next.config.ts`) |

---

## CI/CD — GitHub Actions

### Fluxo por evento

**Pull Request** (sem deploy):
```
push → test (vitest) → typecheck (tsc --noEmit)
```

**Merge para `main`** (deploy completo):
```
push → test → typecheck → build Docker → push ECR → deploy ECS → health check
```

### Autenticação AWS no GitHub Actions

GitHub Actions assume um IAM Role via **OIDC** — token temporário gerado a cada execução, expira em 1 hora. Nenhuma Access Key armazenada no GitHub.

```
GitHub Secret (repositório):
  AWS_ROLE_ARN → arn:aws:iam::507099297746:role/github-actions-autostand
```

O role tem permissão mínima: ECR (push de imagem) + ECS (update service).

### Rolling deploy e rollback

ECS executa rolling update: sobe a nova versão, só derruba a anterior após health check passar. Se falhar, deploy para automaticamente e a versão anterior continua servindo tráfego.

### Health check

ALB verifica `GET /api/health` a cada 30s — endpoint novo que retorna `200 OK`. ECS só considera task saudável após 2 checks consecutivos passarem.

### Dockerfile

`next.config.ts` recebe `output: 'standalone'` — reduz imagem de ~1 GB para ~200 MB.

---

## Storage — S3 substituindo Vercel Blob

### Estratégia de migração de código

`lib/blob.ts` é a única camada que muda — troca `@vercel/blob` por `@aws-sdk/client-s3`. Nenhum componente ou API route é alterado.

- `put(file)` → `s3.PutObjectCommand`
- `del(url)` → `s3.DeleteObjectCommand`
- URLs públicas: `cdn.autostand.com.br/{path}` (CloudFront na frente do S3)

O stub de desenvolvimento (`public/uploads/dev/`) é mantido para rodar localmente sem credenciais AWS.

### Estrutura do bucket

```
autostand-uploads/
  tenants/
    {tenant_id}/
      logo/
      hero/
      photos/
        {vehicle_id}/
      documents/
        {vehicle_id}/
```

Bucket **privado** — acesso público exclusivamente via CloudFront (`cdn.autostand.com.br`).

### Atualização em `next.config.ts`

```ts
// antes
hostname: "*.public.blob.vercel-storage.com"

// depois
hostname: "cdn.autostand.com.br"
```

### Script de migração de blobs existentes

`scripts/migrate-blob-to-s3.ts`:
1. Lê registros no banco com URLs `*.vercel-storage.com`
2. Baixa cada arquivo
3. Faz upload para S3 com o mesmo path
4. Atualiza URL no banco
5. Idempotente — pode ser executado múltiplas vezes

---

## DNS e Roteamento

### Route 53

Hosted zone `autostand.com.br`. Nameservers do registro.br apontados para a AWS.

Registros:
```
autostand.com.br     A → CloudFront distribution A (origin: ALB)
*.autostand.com.br   A → CloudFront distribution A (origin: ALB)
cdn.autostand.com.br A → CloudFront distribution B (origin: S3)
```

`console.autostand.com.br` é coberto pelo wildcard `*.autostand.com.br` — sem registro adicional.

Duas distributions separadas: A serve o app Next.js (cacheia `/_next/static/*`, passa dinâmico direto); B serve assets do S3 (cacheia tudo, sem origem computacional).

### ACM

Certificado wildcard `*.autostand.com.br` + `autostand.com.br`. Validação via DNS (Route 53 — automático). Renovação automática.

### Cutover

1. TTL reduzido para 60s no registro.br (1 dia antes)
2. Nameservers atualizados para Route 53
3. Vercel mantido como fallback até confirmação de estabilidade
4. Remoção do domínio na Vercel após confirmação

---

## Secrets — GitHub Environments

Todos os secrets centralizados em `GitHub → Settings → Environments → production`.

### Lista de secrets

```
# Banco
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN

# Storage
AWS_S3_BUCKET
AWS_S3_REGION

# Rate limiting
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN

# CAPTCHA
TURNSTILE_SECRET_KEY
NEXT_PUBLIC_TURNSTILE_SITE_KEY

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN
MERCADOPAGO_WEBHOOK_SECRET
MERCADOPAGO_PLAN_BASICO
MERCADOPAGO_PLAN_PRO
MERCADOPAGO_PLAN_PREMIUM

# Auth
NEXTAUTH_SECRET
NEXTAUTH_URL

# App
PLATFORM_DOMAIN
PLATFORM_HOSTS
AI_MODEL
ANTHROPIC_API_KEY
```

**Comportamento:** mudança de secret requer novo deploy para o ECS pegar o valor atualizado. Frequência de mudança é baixíssima — sem impacto operacional.

---

## Mercado Pago — Assinaturas Recorrentes

### Preços

| Plano | Preço/mês |
|---|---|
| Básico | R$ 169,90 |
| Pro | R$ 349,90 |
| Premium | R$ 499,90 |

Os valores em `lib/plans.ts` serão atualizados para refletir esses preços.

### Fluxo de assinatura (Preapproval API)

```
1. Tenant preenche /assinar
2. POST /api/assinar → cria tenant (status=suspended)
3. lib/checkout.ts → cria Preapproval no MP → recebe init_point
4. Redirect para init_point (MP gerencia cartão)
5. MP cobra mensalmente de forma automática
6. MP notifica POST /api/webhooks/mercadopago a cada evento
7. AutoStand atualiza status do tenant no banco
```

### Webhook — eventos e ações

| Evento MP | Ação AutoStand |
|---|---|
| `authorized` | `status=active`, `subscription_status=active` |
| `paused` | `subscription_status=past_due` (acesso mantido — suspend automático fora do escopo v1) |
| `cancelled` | `status=suspended`, `subscription_status=cancelled` |
| `payment_failed` | Registra falha (notificação futura via WhatsApp) |

O webhook valida autenticidade via `MERCADOPAGO_WEBHOOK_SECRET` antes de processar.

### Planos no MP

Criados uma vez no painel ou via API. Os IDs resultantes ficam nos GitHub Secrets:
```
MERCADOPAGO_PLAN_BASICO   → id do plano R$169,90/mês
MERCADOPAGO_PLAN_PRO      → id do plano R$349,90/mês
MERCADOPAGO_PLAN_PREMIUM  → id do plano R$499,90/mês
```

### Mudanças de código

| Arquivo | Mudança |
|---|---|
| `lib/checkout.ts` | Implementação real do MP (hoje retorna `null`) |
| `lib/plans.ts` | Preços atualizados |
| `app/api/webhooks/mercadopago/route.ts` | Endpoint novo |
| `app/api/assinar/route.ts` | Redireciona para `init_point` do MP |
| `app/admin/assinatura/page.tsx` | Exibe status + link para portal MP |

---

## Ordem de implementação

| Fase | Entrega | Risco se pular |
|---|---|---|
| 1 | Dockerfile + `output: standalone` | Sem imagem para subir |
| 2 | ECR + ECS + ALB na AWS | Sem compute |
| 3 | GitHub Actions (CI/CD) | Deploy manual |
| 4 | S3 + `lib/blob.ts` | Uploads quebrados |
| 5 | Route 53 + ACM + CloudFront | Sem DNS |
| 6 | GitHub Environments (secrets) | Env vars faltando |
| 7 | DNS cutover (registro.br → Route 53) | Ainda na Vercel |
| 8 | Script migração de blobs | URLs antigas quebram |
| 9 | Mercado Pago billing | Sem receita |
| 10 | Descomissionar Vercel | — |

---

## Fora do escopo

- Múltiplos ambientes (staging) — v1 tem só `production`
- Auto-scaling do ECS — manual por enquanto, suficiente para o estágio atual
- ElastiCache / Redis próprio — Upstash permanece
- Registro automático de domínio próprio via API Vercel — já foi removido do escopo anteriormente
