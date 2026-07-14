# Redução de custo AWS — Synqo (conta 507099297746)

**Data:** 2026-07-13
**Status:** Aprovado, aguardando plano de execução

## Problema

A conta AWS da Synqo tem run-rate de **~US$115/mês** (junho fechou em US$179,58 de uso + imposto) para servir um tráfego de **~1.000 requests/dia** no AutoStand. O custo não é justificado pela carga.

### Fato decisivo: não existe free tier nesta conta

A conta foi criada em ~07/06/2026, já sob o modelo novo de free tier da AWS — **sem os 750h/mês de EC2 e RDS**. Duas evidências diretas:

1. O Cost Explorer cobra US$9,76 pelo `db.t4g.micro` e US$3,42 pelo `t4g.micro` — exatamente os itens que o free tier antigo cobriria.
2. O agrupamento por `RECORD_TYPE` retorna apenas `Usage` e `Tax`. **Nenhuma linha de `Credit`.** Zero créditos aplicados.

Consequência: **"caber no free tier da AWS" não é alcançável** para um app Next.js + Postgres nesta conta. Fargate, ALB e RDS nunca são gratuitos no modelo novo. O caminho para ~US$0 é tirar essas cargas da AWS, não reconfigurá-las.

O que *é* genuinamente gratuito e permanece: **CloudFront** (1 TB/mês de saída, always-free permanente) e o S3 que o alimenta (centavos).

## Estado atual (tudo em `sa-east-1`)

Cadeia do AutoStand: `Route 53 → CloudFront → ALB → ECS Fargate → RDS`, com S3 + CloudFront separados para uploads.

| Recurso | Config | ~US$/mês |
|---|---|---|
| ECS Fargate `autostand-web` | 1 task, 0.5 vCPU / 1 GB, 24/7 | ~31 |
| RDS `autostand-postgres` | db.t4g.micro, PG 18.3, 20 GB gp3, backup 7d | ~26 |
| ALB `autostand-alb` | internet-facing, 2 AZs | ~23 |
| IPv4 públicos | 3 EIPs (2 são as ENIs do ALB) | ~14 |
| EC2 `trintalinhas-homolog` | t4g.micro, running | ~8 |
| EBS | 30 GB gp3 (20 + 10) | ~5 |
| Route 53 | zonas `autostand.com.br`, `synqo.dev.br` | ~1 |
| Secrets Manager + ECR + S3 | | ~1 |

Ociosos já identificados: serviço Fargate `autostand-web-homolog` em `desired=0`, mas com 2 distribuições CloudFront e o bucket `autostand-uploads-homolog` ainda de pé.

**Armadilha verificada:** os 2 EIPs que parecem "não anexados a instância" são as ENIs do ALB (`Description: ELB app/autostand-alb`). Liberá-los derruba o site. Só saem junto com o ALB.

## Arquitetura alvo

| Carga | Hoje | Depois |
|---|---|---|
| AutoStand (app) | ECS Fargate + ALB + ECR + CloudFront | **Vercel Hobby** (build do repo GitHub; TLS e CDN inclusos) |
| AutoStand (banco) | RDS db.t4g.micro | **Neon free** (0.5 GB, autosuspend) |
| AutoStand (uploads) | S3 + CloudFront | **inalterado** — CloudFront always-free cobre |
| AutoStand (homolog) | Fargate + 2 CloudFront + S3 | **destruído** — preview deploys do Vercel substituem |
| Trinta Linhas homolog | EC2 t4g.micro *running* + EIP | EC2 **stopped**, EIP **liberado** |
| DNS | Route 53 (2 zonas) | inalterado |

O `Dockerfile` deixa de ser usado no deploy (o Vercel builda Next.js nativamente) mas permanece no repo para dev local.

### Por que Vercel + Neon

O código já é Next.js 16 + Drizzle com `dialect: "postgresql"` e driver `pg`. Não há reescrita de query.

### Bloqueadores técnicos descobertos (2026-07-13)

A migração **não é** "trocar a `DATABASE_URL`". Três coisas quebram se ignoradas:

1. **`lib/db/client.ts:52` fixa a CA do RDS no caminho do `DATABASE_URL`.** O Neon usa certificado de CA pública (Let's Encrypt). Sem correção, a conexão falha na verificação de TLS. **Exige mudança de código:** CA da AWS só quando o host termina em `.rds.amazonaws.com`; CAs do sistema para o resto.

2. **`lib/s3.ts:8` faz `new S3Client({ region })` sem credenciais.** Depende da cadeia padrão do SDK, que no ECS resolve para a *task role*. **No Vercel essa cadeia não existe** e os uploads falhariam silenciosamente. Exige um usuário IAM dedicado (`s3:PutObject` + `s3:DeleteObject` em `autostand-uploads/*`) com chaves nas envs do Vercel. Não exige mudança de código — o SDK lê `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` do ambiente.

3. **`pg.Pool` em funções serverless.** Precisa do endpoint *pooled* do Neon (`-pooler` no host), senão as conexões curtas do Vercel esgotam o limite do Postgres.

Armadilha adicional: se `DB_HOST` for cadastrada por engano no Vercel, `buildPoolConfig()` ignora a `DATABASE_URL` e tenta o RDS. As envs `DB_*` **não** podem ir para o Vercel.

### Achado de segurança (2026-07-13)

A task definition `autostand:47` guardava **credenciais de produção em texto plano** nas variáveis de ambiente — apenas `DB_PASSWORD` estava no Secrets Manager. Expostas via `ecs:DescribeTaskDefinition`: `MERCADOPAGO_ACCESS_TOKEN` (produção), `MERCADOPAGO_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `AUTH_SECRET`, `PAYMENT_TOKEN_SECRET`, `GMAIL_APP_PASSWORD`, `UPSTASH_REDIS_REST_TOKEN`, `TURSO_AUTH_TOKEN`.

**Todas devem ser rotacionadas antes da migração** (decisão de 2026-07-13). Só valores novos entram no Vercel. As envs do Vercel são criptografadas e não legíveis via API após gravadas, o que resolve a causa raiz.

Env vars mortas identificadas, a **não** migrar: `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` (zero ocorrências no código), `TURNSTILE_SECRET_KEY` e `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (vazias).

Neon é a engine por trás do Vercel Postgres, então a integração com o deploy é nativa, e o branching por PR casa com os preview deploys que vão substituir o homolog.

### Alternativas descartadas

- **Encolher dentro da AWS** (1 EC2 t4g.small com Docker + Caddy + Postgres no host): ~US$15–20/mês e reintroduz operação manual de banco e TLS. Mais barato, mas não é free tier.
- **Serverless AWS** (OpenNext/SST em Lambda + CloudFront + Neon): chega perto de US$0, mas o esforço de migração e o débito operacional do OpenNext não se pagam para 30k req/mês.

## Custo-alvo

| Item | US$/mês |
|---|---|
| Vercel Hobby + Neon free | 0,00 |
| S3 uploads + CloudFront (always-free) | ~0,15 |
| EBS 10 GB (EC2 parada) | ~1,00 |
| Route 53, 2 zonas | 1,00 |
| **Total** | **~US$2,15** |

De ~US$115 para ~US$2/mês.

Zerar o US$1 do Route 53 exige mover o DNS dos 2 domínios para Cloudflare. **Fora de escopo** nesta leva — o ganho não paga o risco de repontar nameserver durante um cutover.

## Ordem de execução

O princípio que ordena tudo: **nada é destruído antes do AutoStand estar validado no Vercel, no domínio real.**

1. **Corte imediato (reversível, independente)** — parar a EC2 `trintalinhas-homolog` e liberar o EIP dela. Vale ~US$11/mês e não toca no AutoStand.
2. **Dump do RDS** — o RDS é `PubliclyAccessible: false`. Abrir acesso temporário (`--publicly-accessible` + regra de SG restrita ao IP atual), `pg_dump`, **fechar imediatamente**. A janela de exposição é o ponto de maior risco do plano e deve ser a mais curta possível.
3. **Neon + Vercel** — criar projeto Neon, restaurar o dump, **medir o tamanho real**. Se passar de 0.5 GB, o plano de banco é replanejado aqui. Subir AutoStand no Vercel com a nova `DATABASE_URL` e as demais envs (migradas do Secrets Manager), validar em URL de preview.
4. **Cutover** — apontar `autostand.com.br` e `console.autostand.com.br` para o Vercel; confirmar que respondem e que os uploads via `cdn.autostand.com.br` seguem funcionando.
5. **Demolição** — só após validação no domínio: serviço + cluster ECS, ALB (leva os 2 EIPs), RDS (**com snapshot final**), ECR, distribuições CloudFront de origem-ALB, stack de homolog inteira.

## Riscos

| Risco | Mitigação |
|---|---|
| Banco maior que 0.5 GB do Neon free | **Risco baixo, não zero.** Ver "Tamanho do banco" abaixo. Medido definitivamente no passo 3, **antes** de qualquer destruição. |
| Janela de exposição do RDS no dump | SG restrito ao IP único da máquina; reverter `PubliclyAccessible` imediatamente após o dump. |
| Perda de dados na demolição | Snapshot final do RDS antes do delete; dump já validado no Neon. |
| Cold start do Neon (autosuspend) | Aceitável para o tráfego atual. Primeira query após ociosidade tem latência extra de ~centenas de ms. |
| Envs faltando no Vercel | Inventariar o Secrets Manager e a task definition do ECS (rev. 47) **antes** do deploy. |

## Tamanho do banco (medido em 2026-07-13)

`FreeStorageSpace` do RDS: **17,04 GB livres de 20 GB → ~2,96 GB ocupados**, estável e sem crescimento em 3 dias.

Esse número **não é o tamanho dos dados**. Ele inclui engine do Postgres, catálogos de sistema, WAL e temp — uma instância RDS PG vazia já ocupa ~2,5 GB do volume. A leitura indica que os dados de aplicação são pequenos (ordem de centenas de MB ou menos) e devem caber nos 0,5 GB do Neon free, mas **isso não está provado**.

Prova definitiva só com o dump, no passo 3. Se estourar 0,5 GB, as saídas são: Neon Launch (~US$19/mo, mata o objetivo) ou reduzir o dataset (purgar dados de teste/seed). Decidir na hora, com o número real na mão.

## Decisões confirmadas (2026-07-13)

- **Sem clientes pagantes hoje** → Vercel Hobby é elegível e o plano segue nele.
- **Dump via exposição temporária do RDS** (SG travado no IP único), e não via task ECS na VPC. Escolha consciente de proporcionalidade: janela curta, banco de projeto em validação.
- **Passo 1 executado**: EC2 `trintalinhas-homolog` parada, EIP `56.126.82.181` liberado. −US$11,60/mês. `autostand.com.br` verificado em HTTP 200 após a mudança.

## Condição que invalida o plano

Vercel Hobby **proíbe uso comercial** nos termos de serviço. O AutoStand é hoje projeto próprio em validação — o plano é válido. **No momento em que houver o primeiro cliente pagante, o Vercel precisa virar Pro (~US$20/mês).** Isso não é uma falha do plano; é o gatilho conhecido de sair dele, e ainda assim fica muito abaixo dos US$115 atuais.

O `docs/Planos e Preços.md` indica que a monetização é intenção do produto — então tratar esse gatilho como *quando*, não *se*.
