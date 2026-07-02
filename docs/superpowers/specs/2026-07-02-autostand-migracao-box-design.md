# AutoStand — Migração de ECS/Fargate para box único (design)

**Data:** 2026-07-02 · **Status:** design aprovado (pré-plano) · **Conta:** `507099297746` (profile `synqo`) · **Região:** `sa-east-1`

## Contexto e motivação

O AutoStand roda hoje em **ECS Fargate + ALB + RDS + CloudFront**, provisionado **manualmente (sem IaC)**.
Pré-receita (sem clientes pagantes ainda), esse custo (~US$76/mês) é dominado por infra "always-on"
cara para tráfego baixo: ALB + 3 EIPs estáticos (~$29), Fargate (~$21), RDS (~$19). O objetivo é
**reduzir custo mantendo `autostand.com.br` no ar**, migrando para o mesmo padrão do box de validação do
trinta-linhas (`trintalinhas/infra/validation`): **1 EC2 + docker-compose + Caddy + CD por pull do ECR**.

**Meta de custo:** AutoStand de ~$76 → **~$48/mês** (conta total ~$103 → ~$75/mês).

### Decisões travadas (com o usuário)
- **RDS mantido** (gerenciado). Sem migração de dados; menor risco. (Mover Postgres pro box fica para
  um segundo momento se quiserem cair mais ~$19.)
- **CloudFront mantido** — só troca o *origin* de ALB → box. Preserva o TLS wildcard `*.autostand.com.br`
  (multi-tenant) sem mexer em certificado.

### Não-objetivos
- Não mover o Postgres para o box (por ora). Não trocar o provedor de e-mail/pagamento. Não redesenhar
  o app. Não mexer no `cdn.autostand.com.br` (CloudFront→S3 de mídia) nem no bucket `autostand-uploads`.

## Arquitetura alvo

```
Cliente ──HTTPS──▶ CloudFront (dist E2ZAXVU5GRBGKB; cert wildcard *.autostand.com.br; forward do Host)
                        │  origin: ALB ❌ → origin.autostand.com.br ✅ (HTTPS)
                        ▼
        origin.autostand.com.br (A → EIP do box)  [Route53 zona autostand.com.br, na conta synqo]
                        │  Caddy :443 (cert do origin via Let's Encrypt DNS-01/Route53)
                        ▼
                app AutoStand (Next.js, imagem do ECR) :3000
                        │
                        ▼
                 RDS autostand-postgres (mantido; box no autostand-rds-sg)
```

- **Box:** EC2 **t4g.small** (Ubuntu arm64, igual ao blueprint), **EIP**, **instance role** (ECR pull,
  Secrets Manager `DB_SECRET_ARN`, SSM params, Route53 do challenge). SG expõe **80/443 apenas para a
  managed prefix list `com.amazonaws.global.cloudfront.origin-facing`** (o box não fica aberto na internet).
  Acesso administrativo via **SSM Session Manager** (sem SSH aberto).
- **docker-compose no box:** `app` (imagem do ECR) + `caddy`. Sem Postgres, sem MediaMTX.
- **Caddy:** reverse-proxy para `app:3000`, TLS do `origin.autostand.com.br` via **Let's Encrypt DNS-01**
  (Route53 da zona `autostand.com.br`, na conta synqo → instance role com permissão no zone). Repasse do
  header `Host` original (multi-tenant). `AUTH_TRUST_HOST=true` já está ligado no app.
- **CloudFront:** origin trocado para `origin.autostand.com.br` (protocolo HTTPS). Cache/headers e o
  forward do `Host` permanecem como hoje (já funcionam com o ALB).

## Config e segredos

Todas as ~28 variáveis viram um `/opt/app/.env` **gerado no boot pela instance role** (nada de chave
versionada no box):
- **Não-segredos** (`DB_HOST/PORT/USER/NAME`, `PLATFORM_DOMAIN/HOSTS`, `AWS_S3_BUCKET/REGION`, `CDN_URL`,
  `AI_MODEL`, `NODE_ENV`, `NEXTAUTH_URL`, `AUTH_TRUST_HOST`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
  `MERCADOPAGO_PLAN_*`) → **SSM Parameter Store (String)**, extraídos da própria task def atual.
- **Segredos** (`AUTH_SECRET`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`,
  `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`,
  `UPSTASH_REDIS_REST_URL/TOKEN`, `TURSO_DATABASE_URL/AUTH_TOKEN`) → **SSM SecureString**.
- **`DB_PASSWORD`** → lido **direto do Secrets Manager** pelo box (o `DB_SECRET_ARN` que o ECS já usa).
  Não precisa recadastrar.

> ⚠️ **Pré-requisito externo:** os valores dos segredos hoje só existem nos *GitHub Actions secrets*
> (write-only, não recuperáveis pela API). O usuário fornece esses valores (ou um `.env` local) uma vez,
> para popular o SSM. Os não-segredos saem da task def `autostand:33`.

## Deploy / CD (espelha o val do trinta-linhas)

- O workflow `deploy-production.yml` deixa de fazer `ecs update-service` e passa a **só buildar e
  empurrar a imagem para o ECR** com uma tag estável que o box observa (ex.: `prod`), no mesmo gatilho
  atual (push na `main`). O role OIDC `github-actions-autostand` continua servindo para o push no ECR.
- **Timer systemd** no box (~1 min) roda um `update.sh` adaptado: `ecr get-login` (via instance role) →
  `docker compose pull app` → `up -d`. Idempotente.
- **Migrations:** serviço one-shot no compose (padrão do `seed` do blueprint) roda as migrations contra o
  **RDS** antes do `app` subir. Substitui o workflow `migrate.yml` no caminho de deploy.

## Cutover e rollback (sem downtime, reversível)

1. **Provisiona o box em paralelo** (Terraform apply) — sem tocar em ECS/ALB/CloudFront.
2. Sobe o app no box e **testa direto** em `origin.autostand.com.br` (bypass do CloudFront): healthcheck,
   login, um tenant real, webhook do Mercado Pago (sandbox).
3. **Troca o origin do CloudFront** (ALB → box). Verifica prod (`autostand.com.br`, um `*.autostand.com.br`).
4. **Mantém ECS + ALB ligados como rollback** por alguns dias — reverter = voltar o origin no CloudFront.
5. Após janela de estabilização: **decomissiona** ECS service `autostand-web`, ALB `autostand-alb`,
   target groups, e libera os 3 EIPs do ALB.

## IaC (resolve o "AutoStand sem IaC")

Escrever **Terraform novo** no repo AutoStand em `infra/box/`, espelhando `trintalinhas/infra/validation`:
EC2 + EIP + SG + instance role/policies + SSM params + record `origin.autostand.com.br` + ajuste do
origin do CloudFront. **State remoto** (bucket de tfstate + lock). Assim a nova infra fica versionada e o
teardown/recriação viram `terraform destroy`/`apply` (diferente do estado manual de hoje). O decomissiona-
mento do ECS/ALB (passo 5) é feito à parte, já que esses recursos não são geridos por Terraform.

## Custo final

| | Antes | Depois |
|---|---|---|
| Compute | Fargate ~$21 | Box t4g.small + EBS + EIP ~$22 |
| Load balancing | ALB + 3 EIPs ~$29 | — (CloudFront direto no box) |
| Banco | RDS ~$19 | RDS ~$19 (mantido) |
| Edge/CDN/misc | CloudFront/S3/ECR/R53 ~$7 | ~$7 |
| **AutoStand** | **~$76/mês** | **~$48/mês** |

Conta total estimada: **~$103 → ~$75/mês**.

## Riscos e mitigação
- **Multi-tenant / Host header:** o app já depende do `Host` encaminhado (funciona hoje via CloudFront→ALB).
  Caddy repassa o `Host`; validar com um tenant real no passo 2/3 do cutover.
- **TLS do origin (DNS-01):** se o DNS-01 via Route53 gerar atrito, fallback = CloudFront→origin em HTTP
  restrito à prefix list do CloudFront (sem cert no box). Decisão final no plano.
- **CD por pull em prod:** o box observa uma tag estável (`prod`) atualizada só pelo pipeline de `main`,
  preservando a cadência de deploy atual (não puxa qualquer `latest`).
- **Perda de dados:** nenhuma — RDS é mantido; nada de migração de banco.

## Critérios de sucesso
- `autostand.com.br` e um `*.autostand.com.br` servindo pelo box via CloudFront, com login e webhook OK.
- Deploy por push na `main` chega no box em ~1 min (CD por pull).
- Infra do box 100% em Terraform. ECS/ALB/EIPs do ALB decomissionados. Custo do AutoStand ~$48/mês.
- Rollback comprovado (voltar origin do CloudFront) durante a janela de estabilização.
