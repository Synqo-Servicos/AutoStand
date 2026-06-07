# AutoStand — Migração Vercel → AWS + Mercado Pago

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar o AutoStand da Vercel para AWS (ECS Fargate + S3 + CloudFront + Route 53) com CI/CD via GitHub Actions, e implementar billing recorrente via Mercado Pago substituindo o seam do Stripe.

**Architecture:** Next.js containerizado (Docker standalone) rodando no ECS Fargate, servido por ALB + CloudFront. Assets de mídia em S3 privado com CDN em `cdn.autostand.com.br`. Pipeline CI/CD no GitHub Actions com OIDC para acesso AWS sem credenciais armazenadas. Billing via Mercado Pago Preapproval (assinaturas recorrentes).

**Tech Stack:** Next.js App Router · Docker · AWS ECS Fargate · ECR · ALB · CloudFront · S3 · Route 53 · ACM · GitHub Actions · `@aws-sdk/client-s3` · `mercadopago` SDK v2 · Drizzle ORM · Turso (libSQL)

**AWS Account:** `507099297746` — região `sa-east-1` (São Paulo)

**Spec:** `docs/superpowers/specs/2026-06-07-infra-aws-mercadopago-design.md`

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `Dockerfile` | Criar | Build multi-stage para Next.js standalone |
| `.dockerignore` | Criar | Excluir node_modules, .next, .env* do contexto |
| `next.config.ts` | Modificar | Adicionar `output: 'standalone'`, atualizar remotePatterns |
| `app/api/health/route.ts` | Criar | Health check para ALB |
| `.github/workflows/test.yml` | Criar | CI em PRs: test + typecheck |
| `.github/workflows/deploy.yml` | Criar | CD em main: build → ECR → ECS |
| `lib/s3.ts` | Criar | Cliente S3 e utilitários de upload/delete |
| `lib/blob.ts` | Modificar | Trocar `@vercel/blob` por `lib/s3.ts` |
| `lib/schema.ts` | Modificar | Adicionar coluna `mp_subscription_id` |
| `drizzle/0012_mp_subscription.sql` | Criar | Migration: adicionar mp_subscription_id |
| `lib/plans.ts` | Modificar | Atualizar preços, trocar `stripePriceId` por `mpPlanId` |
| `lib/checkout.ts` | Modificar | Implementar MP Preapproval (substituir seam do Stripe) |
| `app/api/webhooks/mercadopago/route.ts` | Criar | Webhook de eventos de assinatura do MP |
| `app/api/assinar/route.ts` | Modificar | Redirecionar para `init_point` do MP |
| `app/admin/assinatura/page.tsx` | Modificar | Exibir status MP + link para portal do MP |
| `scripts/migrate-blob-to-s3.ts` | Criar | Migrar URLs de Vercel Blob → S3 |
| `package.json` | Modificar | Adicionar `@aws-sdk/client-s3`, `mercadopago`; remover `@vercel/blob` |

---

## Fase 1 — Health Check + Docker

### Task 1: Health check endpoint

**Files:**
- Criar: `app/api/health/route.ts`
- Criar: `tests/api/health.test.ts`

- [ ] **Escrever o teste**

```typescript
// tests/api/health.test.ts
import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Rodar para confirmar que falha**

```bash
npm test tests/api/health.test.ts
```
Esperado: `FAIL — Cannot find module '@/app/api/health/route'`

- [ ] **Criar o endpoint**

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({ status: 'ok' });
}
```

- [ ] **Rodar para confirmar que passa**

```bash
npm test tests/api/health.test.ts
```
Esperado: `PASS`

- [ ] **Commit**

```bash
git add app/api/health/route.ts tests/api/health.test.ts
git commit -m "feat: health check endpoint para ALB"
```

---

### Task 2: Dockerfile + Next.js standalone

**Files:**
- Criar: `Dockerfile`
- Criar: `.dockerignore`
- Modificar: `next.config.ts`

- [ ] **Adicionar `output: 'standalone'` no next.config.ts**

Localizar o objeto `config` e adicionar a propriedade:

```typescript
const config: NextConfig = {
  output: 'standalone',          // <-- adicionar esta linha
  serverExternalPackages: ["@libsql/client", "libsql"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.autostand.com.br",  // <-- substituir *.public.blob.vercel-storage.com
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  // ... resto igual
};
```

- [ ] **Criar `.dockerignore`**

```
.git
.github
node_modules
.next
.env*
local.db
*.db-shm
*.db-wal
pedro-ivo.db
public/uploads
docs
```

- [ ] **Criar `Dockerfile`**

```dockerfile
FROM node:22-alpine AS base

# Dependências
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Runtime — apenas o standalone (~200 MB vs ~1 GB completo)
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

- [ ] **Testar o build localmente**

```bash
docker build -t autostand:local .
```
Esperado: `Successfully built ...` em ~2-3 minutos. Imagem final ~200 MB.

- [ ] **Testar o container localmente** (com vars mínimas)

```bash
docker run --rm -p 3000:3000 \
  -e NEXTAUTH_SECRET=test-secret \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -e PLATFORM_DOMAIN=localhost \
  autostand:local
```
Esperado: servidor rodando. Abrir `http://localhost:3000` — landing deve aparecer.

- [ ] **Commit**

```bash
git add Dockerfile .dockerignore next.config.ts
git commit -m "feat(docker): Dockerfile multi-stage + standalone output"
```

---

## Fase 2 — AWS Compute (ECR + ECS + ALB)

> Todos os comandos usam o perfil `autostand`. Rode `export AWS_PROFILE=autostand` antes de começar.

### Task 3: ECR + IAM OIDC para GitHub Actions

**Files:** sem código de aplicação — apenas infra AWS via CLI.

- [ ] **Criar repositório ECR**

```bash
aws ecr create-repository \
  --repository-name autostand \
  --region sa-east-1
```
Esperado: JSON com `repositoryUri` tipo `507099297746.dkr.ecr.sa-east-1.amazonaws.com/autostand`. Anotar esse valor.

- [ ] **Criar IAM OIDC provider para GitHub Actions**

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```
Esperado: `{"OpenIDConnectProviderArn": "arn:aws:iam::507099297746:oidc-provider/token.actions.githubusercontent.com"}`

- [ ] **Criar arquivo de trust policy para o role do GitHub Actions**

Substituir `SEU_USUARIO/SEU_REPO` pelo repositório real (ex: `ulpionetto/autostand`):

```bash
cat > /tmp/github-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::507099297746:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
      },
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:SEU_USUARIO/SEU_REPO:ref:refs/heads/main"
      }
    }
  }]
}
EOF
```

- [ ] **Criar o IAM role**

```bash
aws iam create-role \
  --role-name github-actions-autostand \
  --assume-role-policy-document file:///tmp/github-trust-policy.json
```

- [ ] **Criar e anexar a policy de permissões**

```bash
cat > /tmp/github-actions-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition",
        "ecs:UpdateService",
        "ecs:DescribeServices",
        "iam:PassRole"
      ],
      "Resource": "*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name github-actions-autostand \
  --policy-name autostand-deploy \
  --policy-document file:///tmp/github-actions-policy.json
```

- [ ] **Anotar o ARN do role**

```bash
aws iam get-role --role-name github-actions-autostand \
  --query 'Role.Arn' --output text
```
Resultado: `arn:aws:iam::507099297746:role/github-actions-autostand`  
**Salvar esse ARN — vai para o secret `AWS_ROLE_ARN` no GitHub.**

- [ ] **Commit** (sem código, apenas para marcar progresso no plano)

```bash
git commit --allow-empty -m "chore: ECR + IAM OIDC criados na AWS"
```

---

### Task 4: ECS Cluster + Task Definition + ALB + Service

- [ ] **Criar cluster ECS**

```bash
aws ecs create-cluster \
  --cluster-name autostand \
  --region sa-east-1
```

- [ ] **Criar IAM role para a task ECS (execution role)**

```bash
aws iam create-role \
  --role-name ecsTaskExecutionRole-autostand \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole-autostand \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

- [ ] **Criar CloudWatch log group**

```bash
aws logs create-log-group \
  --log-group-name /ecs/autostand \
  --region sa-east-1
```

- [ ] **Criar arquivo de task definition**

Substituir `ECR_URI` pelo URI do ECR anotado na Task 3, e adicionar TODAS as variáveis de ambiente reais do projeto:

```bash
cat > /tmp/task-definition.json << 'EOF'
{
  "family": "autostand",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::507099297646:role/ecsTaskExecutionRole-autostand",
  "containerDefinitions": [{
    "name": "autostand",
    "image": "ECR_URI:latest",
    "portMappings": [{"containerPort": 3000, "protocol": "tcp"}],
    "essential": true,
    "environment": [
      {"name": "NODE_ENV", "value": "production"},
      {"name": "PLATFORM_DOMAIN", "value": "autostand.com.br"},
      {"name": "NEXTAUTH_URL", "value": "https://autostand.com.br"}
    ],
    "secrets": [],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/autostand",
        "awslogs-region": "sa-east-1",
        "awslogs-stream-prefix": "ecs"
      }
    },
    "healthCheck": {
      "command": ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"],
      "interval": 30,
      "timeout": 5,
      "retries": 3,
      "startPeriod": 60
    }
  }]
}
EOF
```

> **Nota:** Os secrets reais (Turso, MP, etc.) serão injetados pelo GitHub Actions a cada deploy via `environment-variables` no workflow — não precisam estar aqui neste JSON inicial.

- [ ] **Registrar a task definition**

```bash
aws ecs register-task-definition \
  --cli-input-json file:///tmp/task-definition.json \
  --region sa-east-1
```

- [ ] **Criar VPC padrão (se não existir) e obter subnet IDs**

```bash
# Obter subnets da VPC padrão
aws ec2 describe-subnets \
  --filters "Name=default-for-az,Values=true" \
  --query 'Subnets[*].SubnetId' \
  --output text \
  --region sa-east-1
```
Anotar os IDs (ex: `subnet-aaa subnet-bbb subnet-ccc`)

- [ ] **Criar security group para o ALB**

```bash
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" \
  --query 'Vpcs[0].VpcId' --output text --region sa-east-1)

aws ec2 create-security-group \
  --group-name autostand-alb-sg \
  --description "AutoStand ALB" \
  --vpc-id $VPC_ID \
  --region sa-east-1

ALB_SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=autostand-alb-sg" \
  --query 'SecurityGroups[0].GroupId' --output text --region sa-east-1)

# Liberar portas 80 e 443
aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0 --region sa-east-1
aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG_ID --protocol tcp --port 443 --cidr 0.0.0.0/0 --region sa-east-1
```

- [ ] **Criar security group para o ECS**

```bash
aws ec2 create-security-group \
  --group-name autostand-ecs-sg \
  --description "AutoStand ECS tasks" \
  --vpc-id $VPC_ID \
  --region sa-east-1

ECS_SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=autostand-ecs-sg" \
  --query 'SecurityGroups[0].GroupId' --output text --region sa-east-1)

# ECS recebe tráfego apenas do ALB
aws ec2 authorize-security-group-ingress \
  --group-id $ECS_SG_ID \
  --protocol tcp --port 3000 \
  --source-group $ALB_SG_ID \
  --region sa-east-1
```

- [ ] **Criar ALB**

```bash
SUBNET_IDS="subnet-aaa subnet-bbb"  # substituir pelos IDs reais

aws elbv2 create-load-balancer \
  --name autostand-alb \
  --subnets $SUBNET_IDS \
  --security-groups $ALB_SG_ID \
  --region sa-east-1
```
Anotar o `LoadBalancerArn` e o `DNSName` do ALB.

- [ ] **Criar target group**

```bash
aws elbv2 create-target-group \
  --name autostand-tg \
  --protocol HTTP \
  --port 3000 \
  --target-type ip \
  --vpc-id $VPC_ID \
  --health-check-path /api/health \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --region sa-east-1
```
Anotar o `TargetGroupArn`.

- [ ] **Criar listener HTTP (porta 80 → redirect 443)**

```bash
ALB_ARN="arn:aws:..."  # substituir pelo ARN anotado

aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP --port 80 \
  --default-actions Type=redirect,RedirectConfig="{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}" \
  --region sa-east-1
```

> **Nota:** O listener HTTPS (443) será criado na Task 9, após o certificado ACM estar validado.

- [ ] **Criar o ECS service**

```bash
TG_ARN="arn:aws:..."  # substituir pelo ARN do target group

aws ecs create-service \
  --cluster autostand \
  --service-name autostand-web \
  --task-definition autostand \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$ECS_SG_ID],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=$TG_ARN,containerName=autostand,containerPort=3000" \
  --health-check-grace-period-seconds 120 \
  --region sa-east-1
```

- [ ] **Verificar que a task está rodando**

```bash
aws ecs describe-services \
  --cluster autostand \
  --services autostand-web \
  --query 'services[0].{status:status,running:runningCount,desired:desiredCount}' \
  --region sa-east-1
```
Esperado após ~2 minutos: `{"status": "ACTIVE", "running": 1, "desired": 1}`

---

## Fase 3 — GitHub Actions CI/CD

### Task 5: Workflows de CI e CD

**Files:**
- Criar: `.github/workflows/test.yml`
- Criar: `.github/workflows/deploy.yml`

- [ ] **Criar diretório**

```bash
mkdir -p .github/workflows
```

- [ ] **Criar workflow de CI (PRs)**

```yaml
# .github/workflows/test.yml
name: CI

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - run: npm ci

      - name: Typecheck
        run: npx tsc --noEmit

      - name: Tests
        run: npm test
```

- [ ] **Criar workflow de CD (deploy ao fazer merge em main)**

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    environment: production

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: sa-east-1

      - name: Login to ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push Docker image
        env:
          REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          SHA: ${{ github.sha }}
        run: |
          docker build -t $REGISTRY/autostand:$SHA -t $REGISTRY/autostand:latest .
          docker push $REGISTRY/autostand:$SHA
          docker push $REGISTRY/autostand:latest

      - name: Download current task definition
        run: |
          aws ecs describe-task-definition \
            --task-definition autostand \
            --query taskDefinition \
            --region sa-east-1 > task-definition.json

      - name: Render task definition with new image and secrets
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: task-definition.json
          container-name: autostand
          image: ${{ steps.login-ecr.outputs.registry }}/autostand:${{ github.sha }}
          environment-variables: |
            NEXTAUTH_SECRET=${{ secrets.NEXTAUTH_SECRET }}
            NEXTAUTH_URL=${{ secrets.NEXTAUTH_URL }}
            PLATFORM_DOMAIN=${{ secrets.PLATFORM_DOMAIN }}
            PLATFORM_HOSTS=${{ secrets.PLATFORM_HOSTS }}
            TURSO_DATABASE_URL=${{ secrets.TURSO_DATABASE_URL }}
            TURSO_AUTH_TOKEN=${{ secrets.TURSO_AUTH_TOKEN }}
            AWS_S3_BUCKET=${{ secrets.AWS_S3_BUCKET }}
            AWS_S3_REGION=${{ secrets.AWS_S3_REGION }}
            CDN_URL=${{ secrets.CDN_URL }}
            UPSTASH_REDIS_REST_URL=${{ secrets.UPSTASH_REDIS_REST_URL }}
            UPSTASH_REDIS_REST_TOKEN=${{ secrets.UPSTASH_REDIS_REST_TOKEN }}
            TURNSTILE_SECRET_KEY=${{ secrets.TURNSTILE_SECRET_KEY }}
            NEXT_PUBLIC_TURNSTILE_SITE_KEY=${{ secrets.NEXT_PUBLIC_TURNSTILE_SITE_KEY }}
            MERCADOPAGO_ACCESS_TOKEN=${{ secrets.MERCADOPAGO_ACCESS_TOKEN }}
            MERCADOPAGO_WEBHOOK_SECRET=${{ secrets.MERCADOPAGO_WEBHOOK_SECRET }}
            MERCADOPAGO_PLAN_BASICO=${{ secrets.MERCADOPAGO_PLAN_BASICO }}
            MERCADOPAGO_PLAN_PRO=${{ secrets.MERCADOPAGO_PLAN_PRO }}
            MERCADOPAGO_PLAN_PREMIUM=${{ secrets.MERCADOPAGO_PLAN_PREMIUM }}
            ANTHROPIC_API_KEY=${{ secrets.ANTHROPIC_API_KEY }}
            AI_MODEL=${{ secrets.AI_MODEL }}

      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: autostand-web
          cluster: autostand
          wait-for-service-stability: true
```

- [ ] **Adicionar `AWS_ROLE_ARN` como secret de repositório no GitHub**

No GitHub: `Settings → Secrets and variables → Actions → New repository secret`
- Nome: `AWS_ROLE_ARN`
- Valor: `arn:aws:iam::507099297646:role/github-actions-autostand`

> Este secret fica no repositório (não no Environment) porque é necessário antes do job `deploy` carregar o environment `production`.

- [ ] **Commit**

```bash
git add .github/
git commit -m "feat(ci): GitHub Actions — CI em PRs + CD em main via OIDC"
```

---

## Fase 4 — Storage S3

### Task 6: S3 bucket + lib/s3.ts + atualizar lib/blob.ts

**Files:**
- Criar: `lib/s3.ts`
- Modificar: `lib/blob.ts`

- [ ] **Criar bucket S3**

```bash
aws s3api create-bucket \
  --bucket autostand-uploads \
  --region sa-east-1 \
  --create-bucket-configuration LocationConstraint=sa-east-1

# Bloquear acesso público direto (acesso só via CloudFront)
aws s3api put-public-access-block \
  --bucket autostand-uploads \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

- [ ] **Instalar AWS SDK**

```bash
npm install @aws-sdk/client-s3
npm uninstall @vercel/blob
```

- [ ] **Criar `lib/s3.ts`**

```typescript
// lib/s3.ts
import 'server-only';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

export const s3 = new S3Client({ region: process.env.AWS_S3_REGION ?? 'sa-east-1' });

export const BUCKET = process.env.AWS_S3_BUCKET ?? '';

/** URL pública via CloudFront. Configurar CDN_URL=https://cdn.autostand.com.br */
export const CDN_URL = (process.env.CDN_URL ?? '').replace(/\/$/, '');

export async function s3Put(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
  return `${CDN_URL}/${key}`;
}

export async function s3Delete(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** Extrai a key S3 de uma URL do CDN. Retorna null se não for nossa URL. */
export function keyFromCdnUrl(url: string): string | null {
  if (!CDN_URL || !url.startsWith(CDN_URL + '/')) return null;
  return url.slice(CDN_URL.length + 1);
}

export const HAS_S3 = Boolean(BUCKET);
```

- [ ] **Atualizar `lib/blob.ts`** — substituir as importações e funções de put/del

Localizar as linhas com `import { put, del } from "@vercel/blob"` e a lógica de `HAS_BLOB_TOKEN`, e substituir pelo seguinte. A lógica de validação (MIME, magic bytes, tamanho) **não muda** — apenas as funções de storage:

```typescript
// lib/blob.ts — remover estas linhas:
// import { put, del } from "@vercel/blob";
// const HAS_BLOB_TOKEN = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
// const IS_PROD = process.env.NODE_ENV === 'production';

// Adicionar no topo (após 'import "server-only"'):
import { s3Put, s3Delete, keyFromCdnUrl, HAS_S3 } from './s3';
const IS_PROD = process.env.NODE_ENV === 'production';
```

Substituir o corpo de `uploadToBlob` (apenas a parte de storage, após `validateUpload`):

```typescript
export async function uploadToBlob(
  file: File,
  folder: string,
  options: UploadOptions,
): Promise<string> {
  const { buffer, mime, ext } = await validateUpload(file, options);

  if (HAS_S3) {
    const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    return s3Put(key, Buffer.from(buffer), mime);
  }

  if (IS_PROD) {
    throw new Error('AWS_S3_BUCKET ausente em produção — configure o S3.');
  }

  return putLocal(Buffer.from(buffer), folder, ext);
}
```

Substituir `deleteFromBlob`:

```typescript
export async function deleteFromBlob(url: string): Promise<void> {
  if (url.startsWith(LOCAL_URL_PREFIX + '/')) return delLocal(url);

  const key = keyFromCdnUrl(url);
  if (HAS_S3 && key) {
    await s3Delete(key);
  }
  // URL externa ou sem S3: best-effort silencioso.
}
```

Substituir a função `isVercelBlobUrl` por (pode remover ou deixar comentada):
```typescript
// isVercelBlobUrl removida — migrado para S3
```

- [ ] **Rodar build para confirmar sem erros de compilação**

```bash
npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Rodar testes**

```bash
npm test
```
Esperado: todos passam.

- [ ] **Commit**

```bash
git add lib/s3.ts lib/blob.ts package.json package-lock.json
git commit -m "feat(storage): migrar Vercel Blob → S3 (@aws-sdk/client-s3)"
```

---

## Fase 5 — CloudFront + Route 53 + ACM

### Task 7: ACM wildcard cert + CloudFront distributions + Route 53

- [ ] **Criar hosted zone no Route 53**

```bash
aws route53 create-hosted-zone \
  --name autostand.com.br \
  --caller-reference "autostand-$(date +%s)"
```
Anotar os 4 nameservers do campo `DelegationSet.NameServers`.

- [ ] **Atualizar nameservers no registro.br**

Acessar `registro.br → autostand.com.br → Editar DNS` e substituir pelos 4 nameservers da AWS. A propagação leva até 24h.

> Reduzir o TTL para 300s antes de fazer isso, se ainda apontar para Vercel.

- [ ] **Solicitar certificado ACM** (deve ser criado em `us-east-1` para funcionar com CloudFront)

```bash
aws acm request-certificate \
  --domain-name "autostand.com.br" \
  --subject-alternative-names "*.autostand.com.br" \
  --validation-method DNS \
  --region us-east-1
```
Anotar o `CertificateArn`.

- [ ] **Validar o certificado via DNS**

```bash
aws acm describe-certificate \
  --certificate-arn "ARN_DO_CERT" \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[*].{Name:ResourceRecord.Name,Value:ResourceRecord.Value}'
```

Adicionar os registros CNAME retornados no Route 53:

```bash
ZONE_ID="Z..."  # ID da hosted zone criada acima

aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "_abc.autostand.com.br.",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "_xyz.acm-validations.aws."}]
      }
    }]
  }'
```
Aguardar status `ISSUED` (~5 minutos):
```bash
aws acm wait certificate-validated \
  --certificate-arn "ARN_DO_CERT" \
  --region us-east-1
```

- [ ] **Criar distribuição CloudFront B (CDN S3 — `cdn.autostand.com.br`)**

```bash
aws cloudfront create-distribution \
  --distribution-config '{
    "CallerReference": "cdn-s3-'$(date +%s)'",
    "Aliases": {"Quantity": 1, "Items": ["cdn.autostand.com.br"]},
    "Origins": {"Quantity": 1, "Items": [{
      "Id": "s3-autostand",
      "DomainName": "autostand-uploads.s3.sa-east-1.amazonaws.com",
      "S3OriginConfig": {"OriginAccessIdentity": ""}
    }]},
    "DefaultCacheBehavior": {
      "TargetOriginId": "s3-autostand",
      "ViewerProtocolPolicy": "redirect-to-https",
      "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
      "AllowedMethods": {"Quantity": 2, "Items": ["GET","HEAD"], "CachedMethods": {"Quantity": 2, "Items": ["GET","HEAD"]}}
    },
    "ViewerCertificate": {
      "ACMCertificateArn": "ARN_DO_CERT",
      "SSLSupportMethod": "sni-only",
      "MinimumProtocolVersion": "TLSv1.2_2021"
    },
    "Enabled": true,
    "HttpVersion": "http2",
    "Comment": "AutoStand CDN S3"
  }'
```
Anotar o `DomainName` da distribuição (ex: `abc123.cloudfront.net`).

- [ ] **Criar distribuição CloudFront A (app ALB — `*.autostand.com.br`)**

```bash
ALB_DNS="autostand-alb-123456.sa-east-1.elb.amazonaws.com"  # substituir

aws cloudfront create-distribution \
  --distribution-config '{
    "CallerReference": "app-alb-'$(date +%s)'",
    "Aliases": {"Quantity": 2, "Items": ["autostand.com.br", "*.autostand.com.br"]},
    "Origins": {"Quantity": 1, "Items": [{
      "Id": "alb-autostand",
      "DomainName": "'$ALB_DNS'",
      "CustomOriginConfig": {
        "HTTPPort": 80, "HTTPSPort": 443,
        "OriginProtocolPolicy": "https-only",
        "OriginSSLProtocols": {"Quantity": 1, "Items": ["TLSv1.2"]}
      }
    }]},
    "DefaultCacheBehavior": {
      "TargetOriginId": "alb-autostand",
      "ViewerProtocolPolicy": "redirect-to-https",
      "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
      "AllowedMethods": {"Quantity": 7, "Items": ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"], "CachedMethods": {"Quantity": 2, "Items": ["GET","HEAD"]}},
      "OriginRequestPolicyId": "b689b0a8-53d0-40ab-baf2-68738e2966ac"
    },
    "CacheBehaviors": {"Quantity": 1, "Items": [{
      "PathPattern": "/_next/static/*",
      "TargetOriginId": "alb-autostand",
      "ViewerProtocolPolicy": "redirect-to-https",
      "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
      "AllowedMethods": {"Quantity": 2, "Items": ["GET","HEAD"], "CachedMethods": {"Quantity": 2, "Items": ["GET","HEAD"]}}
    }]},
    "ViewerCertificate": {
      "ACMCertificateArn": "ARN_DO_CERT",
      "SSLSupportMethod": "sni-only",
      "MinimumProtocolVersion": "TLSv1.2_2021"
    },
    "Enabled": true,
    "HttpVersion": "http2and3",
    "Comment": "AutoStand App"
  }'
```
Anotar o `DomainName` (ex: `xyz789.cloudfront.net`).

- [ ] **Criar listener HTTPS no ALB** (agora que o certificado está pronto)

```bash
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTPS --port 443 \
  --certificates CertificateArn=$CERT_ARN \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN \
  --region sa-east-1
```

- [ ] **Criar registros DNS no Route 53**

```bash
CF_APP_DOMAIN="xyz789.cloudfront.net"
CF_CDN_DOMAIN="abc123.cloudfront.net"

aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch '{
    "Changes": [
      {
        "Action": "CREATE",
        "ResourceRecordSet": {
          "Name": "autostand.com.br",
          "Type": "A",
          "AliasTarget": {"HostedZoneId": "Z2FDTNDATAQYW2", "DNSName": "'$CF_APP_DOMAIN'", "EvaluateTargetHealth": false}
        }
      },
      {
        "Action": "CREATE",
        "ResourceRecordSet": {
          "Name": "*.autostand.com.br",
          "Type": "A",
          "AliasTarget": {"HostedZoneId": "Z2FDTNDATAQYW2", "DNSName": "'$CF_APP_DOMAIN'", "EvaluateTargetHealth": false}
        }
      },
      {
        "Action": "CREATE",
        "ResourceRecordSet": {
          "Name": "cdn.autostand.com.br",
          "Type": "A",
          "AliasTarget": {"HostedZoneId": "Z2FDTNDATAQYW2", "DNSName": "'$CF_CDN_DOMAIN'", "EvaluateTargetHealth": false}
        }
      }
    ]
  }'
```

> `Z2FDTNDATAQYW2` é o Hosted Zone ID padrão do CloudFront para registros Alias — é fixo para todas as distribuições.

---

## Fase 6 — GitHub Environments (Secrets)

### Task 8: Configurar secrets de produção no GitHub

- [ ] **Criar o environment `production` no GitHub**

`github.com/SEU_USUARIO/SEU_REPO → Settings → Environments → New environment → production`

Opcionalmente: ativar "Required reviewers" para proteção extra.

- [ ] **Adicionar todos os secrets ao environment `production`**

Navegar em `Settings → Environments → production → Add secret` para cada um:

```
NEXTAUTH_SECRET         → string aleatória longa (gerar: openssl rand -base64 32)
NEXTAUTH_URL            → https://autostand.com.br
PLATFORM_DOMAIN         → autostand.com.br
PLATFORM_HOSTS          → console.autostand.com.br
TURSO_DATABASE_URL      → libsql://...turso.io
TURSO_AUTH_TOKEN        → eyJ...
AWS_S3_BUCKET           → autostand-uploads
AWS_S3_REGION           → sa-east-1
CDN_URL                 → https://cdn.autostand.com.br
UPSTASH_REDIS_REST_URL  → https://...upstash.io
UPSTASH_REDIS_REST_TOKEN → ...
TURNSTILE_SECRET_KEY    → ...
NEXT_PUBLIC_TURNSTILE_SITE_KEY → ...
MERCADOPAGO_ACCESS_TOKEN → APP_USR-...
MERCADOPAGO_WEBHOOK_SECRET → (definir após criar planos no MP)
MERCADOPAGO_PLAN_BASICO → (definir após criar planos no MP — Task 13)
MERCADOPAGO_PLAN_PRO    → (definir após criar planos no MP — Task 13)
MERCADOPAGO_PLAN_PREMIUM → (definir após criar planos no MP — Task 13)
ANTHROPIC_API_KEY       → sk-ant-...
AI_MODEL                → claude-haiku-4-5
```

- [ ] **Fazer push de um commit para `main` e verificar o pipeline**

```bash
git push origin main
```
No GitHub: `Actions → Deploy` — verificar que o job `test` passa e o `deploy` conclui com sucesso.

---

## Fase 7 — DNS Cutover

### Task 9: Virada de DNS para a AWS

- [ ] **Reduzir TTL no registro.br para 300s** (1 dia antes)

Acessar `registro.br → autostand.com.br → Editar DNS` e reduzir o TTL de todos os registros existentes para 300 segundos. Aguardar 1 dia para o TTL propagar.

- [ ] **Verificar que a infra AWS está respondendo** (antes de trocar o DNS)

```bash
curl -I https://$(aws cloudfront list-distributions \
  --query 'DistributionList.Items[?Comment==`AutoStand App`].DomainName' \
  --output text)/api/health
```
Esperado: `HTTP/2 200`

- [ ] **Atualizar nameservers no registro.br para Route 53**

Substituir os nameservers atuais pelos 4 da hosted zone AWS (anotados na Task 7).

- [ ] **Monitorar propagação**

```bash
watch -n 30 "dig autostand.com.br NS +short"
```
Aguardar aparecerem os nameservers `awsdns-*.` em vez dos da Vercel.

- [ ] **Verificar HTTPS funcionando**

```bash
curl -I https://autostand.com.br/api/health
curl -I https://autoprime.autostand.com.br/api/health
curl -I https://console.autostand.com.br/superadmin/login
```
Todos devem retornar `HTTP/2 200` ou `HTTP/2 307` (redirect de auth).

- [ ] **Remover domínio da Vercel** (após confirmar 24h de estabilidade)

Vercel dashboard → projeto → Settings → Domains → remover `autostand.com.br` e `*.autostand.com.br`.

---

## Fase 8 — Migração de Blobs

### Task 10: Script de migração Vercel Blob → S3

**Files:**
- Criar: `scripts/migrate-blob-to-s3.ts`

- [ ] **Criar o script de migração**

```typescript
// scripts/migrate-blob-to-s3.ts
import { createClient } from '@libsql/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { drizzle } from 'drizzle-orm/libsql';
import { tenants, vehiclePhotos, vehicleDocuments } from '../lib/schema';
import { eq, like } from 'drizzle-orm';

const VERCEL_BLOB_PATTERN = '.public.blob.vercel-storage.com';
const CDN_URL = process.env.CDN_URL ?? 'https://cdn.autostand.com.br';
const BUCKET = process.env.AWS_S3_BUCKET ?? '';
const REGION = process.env.AWS_S3_REGION ?? 'sa-east-1';

const s3 = new S3Client({ region: REGION });
const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(client);

async function migrateUrl(url: string, key: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar ${url}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  return `${CDN_URL}/${key}`;
}

function keyFromVercelUrl(url: string, folder: string): string {
  const filename = url.split('/').pop() ?? `file-${Date.now()}`;
  return `${folder}/${filename}`;
}

async function main() {
  console.log('Iniciando migração Vercel Blob → S3...');
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  // Logos dos tenants (coluna direta)
  const allTenants = await db.select({
    id: tenants.id,
    logo_url: tenants.logo_url,
    layout_config: tenants.layout_config,
  }).from(tenants).all();

  for (const tenant of allTenants) {
    // logo_url
    if (tenant.logo_url?.includes(VERCEL_BLOB_PATTERN)) {
      try {
        const key = keyFromVercelUrl(tenant.logo_url, `tenants/${tenant.id}/logo`);
        const newUrl = await migrateUrl(tenant.logo_url, key);
        await db.update(tenants).set({ logo_url: newUrl }).where(eq(tenants.id, tenant.id));
        console.log(`✓ tenant ${tenant.id} logo_url`);
        migrated++;
      } catch (e) {
        console.error(`✗ tenant ${tenant.id} logo_url:`, e);
        errors++;
      }
    }

    // heroImageUrl fica dentro do JSON layout_config
    const layoutConfig = tenant.layout_config as Record<string, unknown> | null;
    const heroUrl = layoutConfig?.heroImageUrl as string | undefined;
    if (heroUrl?.includes(VERCEL_BLOB_PATTERN)) {
      try {
        const key = keyFromVercelUrl(heroUrl, `tenants/${tenant.id}/hero`);
        const newUrl = await migrateUrl(heroUrl, key);
        await db.update(tenants)
          .set({ layout_config: { ...layoutConfig, heroImageUrl: newUrl } as any })
          .where(eq(tenants.id, tenant.id));
        console.log(`✓ tenant ${tenant.id} heroImageUrl`);
        migrated++;
      } catch (e) {
        console.error(`✗ tenant ${tenant.id} heroImageUrl:`, e);
        errors++;
      }
    }
  }

  // Fotos de veículos
  const photos = await db.select().from(vehiclePhotos)
    .where(like(vehiclePhotos.url, `%${VERCEL_BLOB_PATTERN}%`)).all();

  for (const photo of photos) {
    try {
      const key = keyFromVercelUrl(photo.url, `tenants/photos/${photo.vehicle_id}`);
      const newUrl = await migrateUrl(photo.url, key);
      await db.update(vehiclePhotos).set({ url: newUrl }).where(eq(vehiclePhotos.id, photo.id));
      console.log(`✓ photo ${photo.id}`);
      migrated++;
    } catch (e) {
      console.error(`✗ photo ${photo.id}:`, e);
      errors++;
    }
  }

  // Documentos de veículos
  const docs = await db.select().from(vehicleDocuments)
    .where(like(vehicleDocuments.file_url, `%${VERCEL_BLOB_PATTERN}%`)).all();

  for (const doc of docs) {
    try {
      const key = keyFromVercelUrl(doc.file_url, `tenants/documents/${doc.vehicle_id}`);
      const newUrl = await migrateUrl(doc.file_url, key);
      await db.update(vehicleDocuments).set({ file_url: newUrl }).where(eq(vehicleDocuments.id, doc.id));
      console.log(`✓ doc ${doc.id}`);
      migrated++;
    } catch (e) {
      console.error(`✗ doc ${doc.id}:`, e);
      errors++;
    }
  }

  console.log(`\nConcluído: ${migrated} migrados, ${skipped} ignorados, ${errors} erros`);
  process.exit(errors > 0 ? 1 : 0);
}

main();
```

- [ ] **Adicionar script no package.json**

```json
"scripts": {
  "blob:migrate": "npx tsx scripts/migrate-blob-to-s3.ts"
}
```

- [ ] **Executar a migração contra o banco de produção**

```bash
TURSO_DATABASE_URL=libsql://... \
TURSO_AUTH_TOKEN=eyJ... \
AWS_S3_BUCKET=autostand-uploads \
AWS_S3_REGION=sa-east-1 \
CDN_URL=https://cdn.autostand.com.br \
npm run blob:migrate
```
Esperado: `Concluído: N migrados, 0 erros`

- [ ] **Commit**

```bash
git add scripts/migrate-blob-to-s3.ts package.json
git commit -m "feat(scripts): migração de blobs Vercel → S3"
```

---

## Fase 9 — Mercado Pago Billing

### Task 11: Instalar SDK + atualizar lib/plans.ts

**Files:**
- Modificar: `lib/plans.ts`
- Modificar: `package.json`

- [ ] **Instalar SDK do Mercado Pago**

```bash
npm install mercadopago
```

- [ ] **Atualizar `lib/plans.ts`** — novos preços e remover referências ao Stripe

```typescript
// lib/plans.ts — versão completa atualizada
export type PlanSlug = "basico" | "pro" | "premium";

export interface PlanCapabilities {
  customColors: boolean;
  layoutConfig: boolean;
  customDomain: boolean;
  instagramPost: boolean;
  aiAnalysis: boolean;
  marketInsights: boolean;
}

export interface Plan {
  slug: PlanSlug;
  name: string;
  /** Preço mensal em centavos (BRL). */
  priceMonthly: number;
  /** Plan ID do Mercado Pago — definido via env após criar os planos no MP. */
  mpPlanId: string | undefined;
  capabilities: PlanCapabilities;
}

export const PLANS: Record<PlanSlug, Plan> = {
  basico: {
    slug: "basico",
    name: "Básico",
    priceMonthly: 16990,   // R$ 169,90
    mpPlanId: process.env.MERCADOPAGO_PLAN_BASICO,
    capabilities: {
      customColors: true,
      layoutConfig: false,
      customDomain: false,
      instagramPost: false,
      aiAnalysis: false,
      marketInsights: false,
    },
  },
  pro: {
    slug: "pro",
    name: "Pro",
    priceMonthly: 34990,   // R$ 349,90
    mpPlanId: process.env.MERCADOPAGO_PLAN_PRO,
    capabilities: {
      customColors: true,
      layoutConfig: true,
      customDomain: true,
      instagramPost: true,
      aiAnalysis: false,
      marketInsights: false,
    },
  },
  premium: {
    slug: "premium",
    name: "Premium",
    priceMonthly: 49990,   // R$ 499,90
    mpPlanId: process.env.MERCADOPAGO_PLAN_PREMIUM,
    capabilities: {
      customColors: true,
      layoutConfig: true,
      customDomain: true,
      instagramPost: true,
      aiAnalysis: true,
      marketInsights: true,
    },
  },
};

export const PLAN_SLUGS = Object.keys(PLANS) as PlanSlug[];

export function isPlanSlug(value: unknown): value is PlanSlug {
  return typeof value === "string" && value in PLANS;
}

export function getPlan(slug: string | null | undefined): Plan {
  return isPlanSlug(slug) ? PLANS[slug] : PLANS.basico;
}

export function capabilitiesFor(slug: string | null | undefined): PlanCapabilities {
  return getPlan(slug).capabilities;
}
```

- [ ] **Rodar typecheck** — confirmar que nenhum caller usa `stripePriceId` diretamente

```bash
npx tsc --noEmit
```
Se aparecer erro em algum arquivo referenciando `stripePriceId`, substituir por `mpPlanId`.

- [ ] **Commit**

```bash
git add lib/plans.ts package.json package-lock.json
git commit -m "feat(billing): instalar mercadopago SDK + atualizar preços (169/349/499)"
```

---

### Task 12: Migration 0012 — adicionar mp_subscription_id no schema

**Files:**
- Modificar: `lib/schema.ts`
- Criar: `drizzle/0012_mp_subscription.sql`

- [ ] **Escrever o teste**

```typescript
// tests/schema/mp-subscription.test.ts
import { describe, it, expect } from 'vitest';
import { tenants } from '@/lib/schema';
import { getTableColumns } from 'drizzle-orm';

describe('tenants schema', () => {
  it('has mp_subscription_id column', () => {
    const columns = getTableColumns(tenants);
    expect(columns).toHaveProperty('mp_subscription_id');
  });
});
```

- [ ] **Rodar para confirmar que falha**

```bash
npm test tests/schema/mp-subscription.test.ts
```

- [ ] **Adicionar coluna em `lib/schema.ts`**

Localizar o bloco de billing do tenant (próximo de `stripe_customer_id`) e adicionar:

```typescript
// lib/schema.ts — dentro do export const tenants = sqliteTable('tenants', {
  // ... colunas existentes ...
  stripe_customer_id: text("stripe_customer_id"),
  stripe_subscription_id: text("stripe_subscription_id"),
  /** ID da assinatura Mercado Pago (Preapproval). */
  mp_subscription_id: text("mp_subscription_id"),   // <-- adicionar
  subscription_status: text("subscription_status"),
  // ...
```

- [ ] **Rodar para confirmar que passa**

```bash
npm test tests/schema/mp-subscription.test.ts
```

- [ ] **Gerar a migration**

```bash
npx drizzle-kit generate
```
Confirmar que `drizzle/0012_*.sql` foi gerado com `ALTER TABLE tenants ADD COLUMN mp_subscription_id text`.

- [ ] **Aplicar a migration no banco de produção**

```bash
TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=eyJ... npx drizzle-kit push
```

- [ ] **Commit**

```bash
git add lib/schema.ts drizzle/ tests/schema/mp-subscription.test.ts
git commit -m "feat(schema): adicionar mp_subscription_id (migration 0012)"
```

---

### Task 13: Criar planos no Mercado Pago

- [ ] **Criar os 3 planos via API do MP**

Executar os 3 comandos abaixo (substituindo `SEU_ACCESS_TOKEN`). Cada um retorna um `id` — anotar para o próximo passo.

```bash
# Plano Básico
curl -X POST https://api.mercadopago.com/preapproval_plan \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "AutoStand Básico",
    "auto_recurring": {
      "frequency": 1,
      "frequency_type": "months",
      "transaction_amount": 169.90,
      "currency_id": "BRL"
    },
    "back_url": "https://autostand.com.br/admin/assinatura",
    "status": "active"
  }'

# Plano Pro
curl -X POST https://api.mercadopago.com/preapproval_plan \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "AutoStand Pro",
    "auto_recurring": {
      "frequency": 1,
      "frequency_type": "months",
      "transaction_amount": 349.90,
      "currency_id": "BRL"
    },
    "back_url": "https://autostand.com.br/admin/assinatura",
    "status": "active"
  }'

# Plano Premium
curl -X POST https://api.mercadopago.com/preapproval_plan \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "AutoStand Premium",
    "auto_recurring": {
      "frequency": 1,
      "frequency_type": "months",
      "transaction_amount": 499.90,
      "currency_id": "BRL"
    },
    "back_url": "https://autostand.com.br/admin/assinatura",
    "status": "active"
  }'
```

Cada resposta tem `"id": "2c938084..."` — salvar os 3 IDs.

- [ ] **Atualizar secrets no GitHub Environment `production`**

```
MERCADOPAGO_PLAN_BASICO  → id do plano Básico
MERCADOPAGO_PLAN_PRO     → id do plano Pro
MERCADOPAGO_PLAN_PREMIUM → id do plano Premium
```

- [ ] **Configurar webhook no painel do MP**

`mercadopago.com.br → Seu negócio → Configurações → Notificações → Webhooks`
- URL: `https://autostand.com.br/api/webhooks/mercadopago`
- Eventos: `preapproval`
- Copiar o `secret` gerado → salvar como `MERCADOPAGO_WEBHOOK_SECRET` no GitHub

---

### Task 14: lib/checkout.ts — implementar MP Preapproval

**Files:**
- Modificar: `lib/checkout.ts`
- Criar: `tests/lib/checkout.test.ts`

- [ ] **Escrever o teste**

```typescript
// tests/lib/checkout.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do SDK do MP
vi.mock('mercadopago', () => ({
  default: vi.fn(),
  PreApproval: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue({
      id: 'sub_test_123',
      init_point: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=test',
      status: 'pending',
    }),
    update: vi.fn().mockResolvedValue({ status: 'cancelled' }),
  })),
}));

describe('createCheckoutSession', () => {
  beforeEach(() => {
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'test-token';
    process.env.MERCADOPAGO_PLAN_BASICO = 'plan_basico_id';
    process.env.NEXTAUTH_URL = 'https://autostand.com.br';
  });

  it('retorna init_point para plano básico', async () => {
    const { createCheckoutSession } = await import('@/lib/checkout');
    const result = await createCheckoutSession(
      { id: 'tenant_1', slug: 'autoprime' } as any,
      { slug: 'basico', mpPlanId: 'plan_basico_id' } as any,
      null,
    );
    expect(result).toContain('mercadopago.com.br');
  });

  it('retorna null quando mpPlanId não está configurado', async () => {
    process.env.MERCADOPAGO_PLAN_BASICO = '';
    const { createCheckoutSession } = await import('@/lib/checkout');
    const result = await createCheckoutSession(
      { id: 'tenant_1', slug: 'autoprime' } as any,
      { slug: 'basico', mpPlanId: undefined } as any,
      null,
    );
    expect(result).toBeNull();
  });
});
```

- [ ] **Rodar para confirmar que falha**

```bash
npm test tests/lib/checkout.test.ts
```

- [ ] **Reescrever `lib/checkout.ts`**

```typescript
// lib/checkout.ts
import MercadoPagoConfig, { PreApproval } from 'mercadopago';
import type { Plan } from '@/lib/plans';
import type { PartnerRow, TenantRow } from '@/lib/schema';

function getMpClient() {
  return new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
  });
}

/**
 * Cria uma assinatura recorrente no Mercado Pago e retorna a URL de aprovação
 * (`init_point`) para onde o tenant deve ser redirecionado para informar o cartão.
 *
 * Retorna null se o plano não tiver mpPlanId configurado — mantém o fluxo sem
 * billing (tenant fica como incomplete, igual ao comportamento anterior).
 */
export async function createCheckoutSession(
  tenant: TenantRow,
  plan: Plan,
  _partner: PartnerRow | null,
): Promise<string | null> {
  if (!plan.mpPlanId) return null;

  const preApproval = new PreApproval(getMpClient());
  const backUrl = `${process.env.NEXTAUTH_URL}/admin/assinatura`;

  const result = await preApproval.create({
    body: {
      preapproval_plan_id: plan.mpPlanId,
      reason: `AutoStand ${plan.name}`,
      back_url: backUrl,
      status: 'pending',
      external_reference: tenant.id,
    },
  });

  return result.init_point ?? null;
}

export async function cancelMpSubscription(subscriptionId: string): Promise<void> {
  const preApproval = new PreApproval(getMpClient());
  await preApproval.update({
    id: subscriptionId,
    body: { status: 'cancelled' },
  });
}
```

- [ ] **Rodar para confirmar que passa**

```bash
npm test tests/lib/checkout.test.ts
```

- [ ] **Commit**

```bash
git add lib/checkout.ts tests/lib/checkout.test.ts
git commit -m "feat(billing): implementar MP Preapproval em lib/checkout.ts"
```

---

### Task 15: Webhook do Mercado Pago

**Files:**
- Criar: `app/api/webhooks/mercadopago/route.ts`
- Criar: `tests/api/webhooks/mercadopago.test.ts`

- [ ] **Escrever o teste**

```typescript
// tests/api/webhooks/mercadopago.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createHmac, timingSafeEqual } from 'crypto';

// Utilitário para gerar assinatura válida
function makeSignature(secret: string, dataId: string, requestId: string, ts: string) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const hash = createHmac('sha256', secret).update(manifest).digest('hex');
  return `ts=${ts},v1=${hash}`;
}

vi.mock('@/lib/db', () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

vi.mock('mercadopago', () => ({
  default: vi.fn(),
  PreApproval: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue({
      id: 'sub_123',
      status: 'authorized',
      external_reference: 'tenant_abc',
    }),
  })),
}));

describe('POST /api/webhooks/mercadopago', () => {
  beforeEach(() => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'test_secret';
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'test_token';
  });

  it('retorna 200 para evento preapproval autorizado', async () => {
    const { POST } = await import('@/app/api/webhooks/mercadopago/route');
    const ts = String(Math.floor(Date.now() / 1000));
    const requestId = 'req-123';
    const sig = makeSignature('test_secret', 'sub_123', requestId, ts);

    const req = new Request('http://localhost/api/webhooks/mercadopago', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': sig,
        'x-request-id': requestId,
      },
      body: JSON.stringify({ type: 'preapproval', data: { id: 'sub_123' } }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it('retorna 401 para assinatura inválida', async () => {
    const { POST } = await import('@/app/api/webhooks/mercadopago/route');
    const req = new Request('http://localhost/api/webhooks/mercadopago', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': 'ts=123,v1=invalido',
        'x-request-id': 'req-456',
      },
      body: JSON.stringify({ type: 'preapproval', data: { id: 'sub_456' } }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Rodar para confirmar que falha**

```bash
npm test tests/api/webhooks/mercadopago.test.ts
```

- [ ] **Criar `app/api/webhooks/mercadopago/route.ts`**

```typescript
// app/api/webhooks/mercadopago/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import MercadoPagoConfig, { PreApproval } from 'mercadopago';
import { db } from '@/lib/db';
import { tenants } from '@/lib/schema';
import { eq } from 'drizzle-orm';

function getMpClient() {
  return new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! });
}

function verifySignature(
  secret: string,
  xSignature: string,
  xRequestId: string,
  dataId: string,
): boolean {
  const parts = Object.fromEntries(xSignature.split(',').map(p => p.split('=')));
  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
  } catch {
    return false;
  }
}

const STATUS_MAP: Record<string, { status: string; subscription_status: string }> = {
  authorized: { status: 'active',    subscription_status: 'active' },
  paused:     { status: 'active',    subscription_status: 'past_due' },
  cancelled:  { status: 'suspended', subscription_status: 'cancelled' },
};

export async function POST(req: NextRequest) {
  const body = await req.json();

  const xSignature = req.headers.get('x-signature') ?? '';
  const xRequestId = req.headers.get('x-request-id') ?? '';
  const dataId = body.data?.id ?? '';
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? '';

  if (!verifySignature(secret, xSignature, xRequestId, dataId)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (body.type !== 'preapproval' || !dataId) {
    return NextResponse.json({ received: true });
  }

  const preApproval = new PreApproval(getMpClient());
  const subscription = await preApproval.get({ id: dataId });

  const tenantId = subscription.external_reference;
  const mpStatus = subscription.status as string;
  const update = STATUS_MAP[mpStatus];

  if (tenantId && update) {
    await db.update(tenants)
      .set({
        ...update,
        mp_subscription_id: dataId,
      })
      .where(eq(tenants.id, tenantId));
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Rodar para confirmar que passa**

```bash
npm test tests/api/webhooks/mercadopago.test.ts
```

- [ ] **Commit**

```bash
git add app/api/webhooks/mercadopago/ tests/api/webhooks/
git commit -m "feat(billing): webhook Mercado Pago — atualiza status do tenant"
```

---

### Task 16: Atualizar /api/assinar para redirecionar para o MP

**Files:**
- Modificar: `app/api/assinar/route.ts`

A lógica atual retorna `{ ok: true, slug, checkoutUrl }`. O frontend (`app/(public)/assinar/page.tsx`) precisa ser verificado para fazer o redirect quando `checkoutUrl` não é null.

- [ ] **Verificar como o frontend usa `checkoutUrl`**

```bash
grep -n "checkoutUrl\|init_point\|redirect" app/\(public\)/assinar/page.tsx
```

- [ ] **Atualizar `app/api/assinar/route.ts`** — retornar redirect direto quando MP retornar URL

Localizar o bloco final do POST e substituir:

```typescript
// antes (linha final da rota):
return NextResponse.json({ ok: true, slug: tenant.slug, checkoutUrl }, { status: 201 });

// depois:
if (checkoutUrl) {
  // Redirect direto para o MP — tenant fica suspended até o webhook confirmar
  return NextResponse.json({ ok: true, slug: tenant.slug, checkoutUrl }, { status: 201 });
}

// Sem billing configurado: mantém fluxo legado (incomplete, admin ativa manualmente)
return NextResponse.json({ ok: true, slug: tenant.slug, checkoutUrl: null }, { status: 201 });
```

> **Nota:** O comportamento do frontend não muda — ele já verifica `checkoutUrl` e redireciona. Ver `app/(public)/assinar/page.tsx` para confirmar.

- [ ] **Confirmar que o frontend lida com o redirect**

```bash
grep -A 10 "checkoutUrl" app/\(public\)/assinar/page.tsx
```
Se o frontend não faz `window.location.href = checkoutUrl`, adicionar:

```typescript
// No handler de submit da página /assinar, após receber a resposta 201:
if (data.checkoutUrl) {
  window.location.href = data.checkoutUrl;
  return;
}
router.push('/assinar/sucesso');
```

- [ ] **Commit**

```bash
git add app/api/assinar/route.ts app/\(public\)/assinar/
git commit -m "feat(billing): redirecionar para MP após cadastro"
```

---

### Task 17: Atualizar /admin/assinatura para exibir status MP

**Files:**
- Modificar: `app/admin/assinatura/page.tsx` (ou equivalente)

- [ ] **Localizar a página de assinatura**

```bash
find app -name "*.tsx" | xargs grep -l "assinatura\|subscription" 2>/dev/null
```

- [ ] **Atualizar para exibir status MP e link de gestão**

Adicionar junto ao bloco de status existente:

```tsx
{/* Status Mercado Pago */}
{tenant.mp_subscription_id && (
  <div className="mt-4">
    <p className="text-sm text-neutral-500">
      Assinatura Mercado Pago: <code className="text-xs">{tenant.mp_subscription_id}</code>
    </p>
    <a
      href="https://www.mercadopago.com.br/subscriptions"
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex items-center gap-1 text-sm text-brand-primary hover:underline"
    >
      Gerenciar cartão no Mercado Pago →
    </a>
  </div>
)}
```

- [ ] **Rodar build**

```bash
npx next build
```
Esperado: sem erros.

- [ ] **Commit**

```bash
git add app/admin/assinatura/
git commit -m "feat(admin): exibir status e link MP em /admin/assinatura"
```

---

## Fase 10 — Descomissionar Vercel

### Task 18: Remoção da Vercel

- [ ] **Confirmar 24h de operação estável na AWS**

Verificar CloudWatch logs em `/ecs/autostand` — sem erros 500 persistentes.

- [ ] **Remover `@vercel/blob` definitivamente** (já foi feito na Task 6 — confirmar)

```bash
grep "@vercel/blob" package.json
```
Esperado: sem resultado.

- [ ] **Remover variáveis de ambiente Vercel do código**

```bash
grep -rn "BLOB_READ_WRITE_TOKEN\|VERCEL\|vercel-storage" lib/ app/ --include="*.ts" --include="*.tsx"
```
Substituir qualquer referência restante pela lógica S3.

- [ ] **Remover projeto da Vercel**

Vercel dashboard → projeto `autostand` (ou `pedro-ivo-veiculos`) → Settings → Advanced → Delete Project.

> Confirmar que o DNS já migrou completamente antes de deletar.

- [ ] **Commit final**

```bash
git add -A
git commit -m "chore: remover referências à Vercel — migração concluída"
```

---

## Resumo das Fases

| Fase | Tasks | Entrega |
|---|---|---|
| 1 — Docker | 1-2 | Health check + container funcionando |
| 2 — Compute AWS | 3-4 | ECR + ECS + ALB rodando |
| 3 — CI/CD | 5 | Pipeline GitHub Actions funcionando |
| 4 — Storage | 6 | S3 substituindo Vercel Blob |
| 5 — DNS/CDN | 7 | Route 53 + CloudFront + ACM |
| 6 — Secrets | 8 | GitHub Environments configurados |
| 7 — Cutover | 9 | DNS apontando para AWS |
| 8 — Migração | 10 | Arquivos antigos em S3 |
| 9 — MP Billing | 11-17 | Assinaturas recorrentes funcionando |
| 10 — Cleanup | 18 | Vercel desativada |
