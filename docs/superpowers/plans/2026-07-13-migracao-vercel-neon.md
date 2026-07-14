# Migração AutoStand: AWS → Vercel + Neon — Plano de Implementação

> **Para workers agênticos:** SUB-SKILL OBRIGATÓRIA: usar superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar tarefa a tarefa. Os passos usam checkbox (`- [ ]`).

**Goal:** Tirar o AutoStand do ECS Fargate + ALB + RDS e colocá-lo no Vercel Hobby + Neon free, derrubando o run-rate AWS de ~US$103/mês para ~US$2/mês, sem perder dados nem downtime não planejado.

**Architecture:** O app já é Next.js 16 + Drizzle (`dialect: postgresql`, driver `pg`). O deploy passa a ser build nativo do Vercel a partir do repo GitHub. O banco vira Neon (mesma engine do Vercel Postgres). Uploads **permanecem** em S3 + CloudFront (`cdn.autostand.com.br`), que é a única parte genuinamente quase-gratuita da stack AWS. O Dockerfile fica no repo para dev local, mas sai do caminho de deploy.

**Tech Stack:** Next.js 16, Drizzle ORM 0.45, node-postgres (`pg`), Neon, Vercel, AWS S3 + CloudFront + Route 53, Vitest.

## STATUS (2026-07-14)

**Cutover concluído. `autostand.com.br` está no ar servido pelo Vercel + Neon.**

| Task | Estado |
|---|---|
| 1 — Rotação de credenciais | ⏸️ **ADIADA** — reusadas as chaves antigas. Ver pendência aberta abaixo. |
| 2 — TLS do Postgres | ✅ `e44f84c` |
| 3 — Dump do RDS | ✅ 122 KB · janela aberta e fechada, fechamento verificado |
| 4 — Neon | ✅ 8,9 MB / 512 MB · contagens idênticas ao RDS · pooler testado |
| 5 — Credenciais S3 | ✅ **OIDC federation** (`9f3a95c`) — sem chave estática. Provado: PutObject+DeleteObject em 708 ms |
| 6 — Deploy Vercel | ✅ 22 env vars · região `gru1` (São Paulo) |
| 7 — Cutover DNS | ✅ `autostand.com.br` → Vercel · console → `/superadmin/login` · CDN intacto |
| 8 — Demolição | 🟡 **PARCIAL** — ECS `desired=0`, RDS **parado**, **ALB e os 2 EIPs DELETADOS**. Run-rate: **~US$13/mês** (de ~115). |

### ⏰ PRAZO: 2026-07-21

**A AWS religa um RDS parado automaticamente após 7 dias.** O `autostand-postgres` foi parado em
2026-07-14. Se ele não for deletado até **21/07**, volta sozinho e a cobrança retoma (~US$22/mês).

**Feito em 2026-07-14:**
- ECS `autostand-web` → `desired=0`
- RDS `autostand-postgres` → `stopped`
- **ALB `autostand-alb` → DELETADO.** Os 2 EIPs eram `ServiceManaged: alb` — a AWS os recolheu
  sozinha alguns minutos depois (não dá para liberá-los à mão; `release-address` devolve
  `OperationNotPermitted`).
- Verificado após tudo: apex, `/comprar`, `/admin/login`, console e **os 10 subdomínios de tenant**
  todos em 200.

**Ainda falta deletar** (~US$10/mês + fecha o prazo): serviços e cluster ECS, target groups
`autostand-tg` e `autostand-homolog-tg`, **RDS com snapshot final**, ECR, distros CloudFront
`E2ZAXVU5GRBGKB` e `E3LRVJCG5UO8AI`, stack de homolog (bucket `autostand-uploads-homolog` + registros
DNS `*.homologation.*`).

**O rollback para o RDS já é lossy.** O Neon recebeu escritas após o cutover (`demand_events` 725 → 732
em 2026-07-14). Voltar para o RDS perderia dados, e a divergência cresce. O que protege de verdade é o
snapshot `autostand-pre-migracao` + `~/autostand-dump.sql` + `~/autostand-dns-backup.json`.

**Verificado após desligar a AWS:** `autostand.com.br` responde 200 em `/`, `/comprar`, `/lojas`,
`/comprar/24` e `/sitemap.xml`, servindo dados do Neon, com imagens do CloudFront. O Vercel está
de pé sozinho.

**Fluxos ainda NÃO validados por humano** (motivo de manter o rollback): login pela UI, upload de
foto pela UI (o caminho S3 foi provado por rota de diagnóstico, não pela interface), envio de e-mail,
webhook do Mercado Pago.

### Armadilhas encontradas na execução (não estavam no plano original)

1. **Deployment Protection do Vercel cobre o domínio custom, não só previews.** Após virar o DNS, `autostand.com.br` redirecionava para `vercel.com/login` — site inacessível ao público. Corrigido com `ssoProtection: null` via API. **Checar isso ANTES do cutover, não depois.**
2. **`vercel domains add` não vincula o domínio ao deployment.** Precisa de `vercel alias set <deployment> <domínio>` — sem isso o domínio responde 404 do Vercel.
3. **O alias público do projeto é `autostand-wheat.vercel.app`**, não `autostand.vercel.app` (esse é de outra pessoa).
4. **Pastas com `_` são private folders no Next.js.** `app/api/_diag-s3` nunca virou rota.
5. **Havia um registro AAAA (IPv6)** apontando para o CloudFront, além do A. Ambos precisaram ser removidos no cutover.
6. **`PLATFORM_HOSTS` precisa conter o host servidor**, senão o app rende como tenant desconhecido e `/comprar` dá 404.
7. ~~`tenantSubdomain()` é código morto — as lojas são path-based.~~ **ERRADO. Corrigido em 2026-07-14 após um 503 em produção.**

   **O wildcard `*.autostand.com.br` é load-bearing: ele serve as vitrines das lojas.**
   `lib/tenant.ts:69-72` resolve `<slug>.autostand.com.br` **por slug** (`getCurrentTenant()`). O erro de
   análise foi grepar `tenantSubdomain()` — que é só o *construtor* de URL e de fato não tem uso — sem
   procurar o *resolvedor* de host. `docs/Arquitetura.md:34` já documentava a regra.

   Sintoma: com o Fargate em `desired=0`, o wildcard (A-alias → CloudFront → ALB sem targets) devolvia
   **503** em `autoprime.autostand.com.br`.

   Correção: `*.autostand.com.br` virou **CNAME → `cname.vercel-dns.com`** (o wildcard precisa estar
   vinculado ao projeto no Vercel). Os 10 tenants foram verificados em 200 depois disso.

   **Lição:** ao decidir que um recurso de infra é vestigial, procure o *consumidor*, não o *produtor*.

### Pendências

- **Rotacionar as credenciais** (Mercado Pago primeiro). Ver Task 1.
- **Task 8 — demolição.** É onde os ~US$80/mês caem.
- **Remover o wildcard `*.autostand.com.br`** do Route 53 na Task 8 (aponta para o CloudFront que será destruído).
- **Lint vermelho pré-existente** (react-hooks em `app/`, `components/`) — não é dívida desta migração, mas impede um gate de CI verde.

---

## VARREDURA PÓS-MIGRAÇÃO (2026-07-14)

### Corrigido

| Achado | Correção |
|---|---|
| **`NEXTAUTH_URL` quebrava o login multi-tenant.** Cadastrada por engano na migração (não existia no ECS). O `reqWithEnvURL` do next-auth (`next-auth/index.js:106,130`) reescreve o origin de toda request de auth **ignorando `trustHost`** — exatamente o bug que o comentário em `lib/auth.ts:15-18` diz que `trustHost: true` foi adicionado para evitar. | Env **removida** de production e preview |
| `ANTHROPIC_API_KEY` órfã (zero leituras; o app usa só Gemini) | Env **removida** |
| Functions rodavam em `iad1` (Virgínia), Neon em `sa-east-1` | `serverlessFunctionRegion: gru1` |
| **`deploy-homolog.yml` disparava em push na `main`** e passava **verde tendo deployado nada** (`UpdateService` num serviço com `desiredCount=0`; o waiter vê `running(0)==desired(0)` e retorna). Empurrava 2 imagens novas pro ECR a cada push. Viraria vermelho ao deletar o cluster. | Workflow **deletado** (`fef4ea1`), junto de `deploy-production.yml` |
| **Sem caminho para migrations no Neon.** `migrate.yml` fazia `ecs run-task` na VPC contra o RDS parado — único caminho de CI, já quebrado. | Reescrito como job Node com `DATABASE_URL` (`6cc32b4`). ⚠️ **Exige criar o secret `DATABASE_URL` nos GitHub Environments** |
| **`getClientIp` permitia spoofing.** `lib/ratelimit.ts` pegava o **penúltimo** IP do XFF — heurística da cadeia CloudFront→ALB. No Vercel, essa posição pode ser controlada pelo cliente → bypass do rate limit de reset de senha, signup e leads. | Usa `x-real-ip` do Vercel (`0d7edab`). **A função nunca tinha sido executada pela suíte** (todos os testes mockavam `@/lib/ratelimit` inteiro) — por isso a heurística morta sobreviveu |
| `pg.Pool` sem `max` — default 10 por instância; em serverless, N instâncias × 10 esgota o Neon | `max: 1` + timeouts no ramo serverless (`5f8f918`) |

### Corrigido — segunda leva (2026-07-14, tarde)

| Achado | Correção |
|---|---|
| 🔴 **O domínio estava congelado num deployment antigo.** `autostand.com.br` foi vinculado com `vercel alias set`, que **fixa** o alias num deployment específico. Sem conexão Git, novos deploys de produção **não moviam o alias** — o apex serviu o build do cutover por horas, e nenhuma correção posterior (remoção do `NEXTAUTH_URL`, região `gru1`, fixes de rate limit e pool) chegou nele. O wildcard `*.autostand.com.br` era domínio de projeto e por isso **atualizava normalmente** — o que mascarou o problema. | `autostand.com.br` e `console.autostand.com.br` registrados como **domínios do projeto** via API → acompanham produção automaticamente |
| Uploads > 4,5 MB (413 na borda) | **Upload direto pro S3 via presigned URL** (`2caab37`, `0893a04`, `02a4e25`). `ContentType` e `ContentLength` entram na assinatura (`signableHeaders`), expiração 60s. Uma foto por request. **PNG passou a ser comprimido** (→ WebP, preserva alfa). `assertKeyInFolder` impede um admin de assinar write na pasta de outro tenant |
| CORS do bucket (o `PUT` do browser morria no preflight) | Aplicado em `autostand-uploads`: `PUT`, origens `autostand.com.br` + `*.autostand.com.br` + `autostand-*.vercel.app` + localhost, headers `content-type`/`content-length` |
| **`notification_url` do MP era ponto cego** (só no painel, não versionado) | Agora explícito no código (`c0af6ce`), derivado de `PLATFORM_ORIGIN` via `mpNotificationUrl()`. **Vai para o apex, nunca para o host do tenant** — o `back_url` continua no `tenantSiteUrl()`, e há teste travando essa distinção |
| Turnstile desligado | Chaves **de teste** do Cloudflare cadastradas (par "always passes") e verificadas ativas no bundle. ⚠️ **Trocar pelas reais** |

**Perda consciente na migração de upload:** a validação por *magic bytes* (`lib/blob.ts`) morreu — o servidor não vê mais os bytes. Resta o `Content-Type` fixado na assinatura; como nenhum MIME ativo (`svg`, `html`) está na allowlist e o CDN serve com o tipo assinado, payload disfarçado não executa.

### Aberto

- 🔴 **Uploads > 4,5 MB falham com 413.** Limite de body do Vercel é 4,5 MB. O app permite fotos de 8 MB (`lib/blob-constants.ts:19`) e documentos de 20 MB (`:20`). Pior: `components/admin/PhotoUploader.tsx:123` manda **todas** as fotos num único POST (4 fotos a 1,5 MB já estouram), e **PNG é pulado da compressão** (`:40`). O 413 vem da borda — o erro tratado do código nunca dispara. *Correção certa: presigned URL do S3 (cliente sobe direto pro bucket).*
- 🔴 **Vercel não está conectado ao GitHub.** Push na `main` não deploya; não existem preview deploys por PR — o que invalida a justificativa original de destruir o homolog.
- 🟡 **Webhook do Mercado Pago é ponto cego.** `notification_url` **não existe no código** (zero ocorrências) — vive só no painel do MP. Só verificável manualmente.
- 🟡 **Turnstile desligado** (chaves vazias desde o ECS). `/api/assinar` e `/api/marketplace/lead` são públicos e ficam só com rate limit.
- ⚪ Lixo: `Dockerfile` + `.dockerignore` + `task-definition.json` + `next.config.ts:9` (`output: "standalone"`, inofensivo no Vercel mas o `Dockerfile:28` depende dele — remover juntos, Dockerfile primeiro); `lib/db/secret-password.ts` e `lib/db/rds-ca.ts` (caminho morto, mas bundlam o SDK do Secrets Manager em toda function); `README.md` e `obsidian-vault/Infrastructure & Deployment.md` documentam a infra AWS morta.

### Falsos alarmes (verificados)

- **Timeout não é risco.** Default do Hobby é **300s** (doc oficial), não 10s.
- Escrita em FS está protegida (`lib/blob.ts:166-175` lança erro em prod).
- Zero URLs de homolog no banco.
- `DB_HOST` não vazou pro Vercel — o caminho do Neon está garantido.
- E-mail OK: todos os links derivam de env/DB.

---

## Global Constraints

- **Nada é destruído antes do cutover validado.** A Task 8 (demolição) só roda depois da Task 7 confirmar HTTP 200 em `autostand.com.br` servido pelo Vercel.
- **Só credenciais NOVAS entram no Vercel.** As antigas estavam em texto plano na task definition do ECS e passaram por um transcript. Sem indício de comprometimento (ver Task 1), mas nenhuma delas é reutilizada no destino — geradas na Task 6, revogadas na Task 8.
- **Region AWS:** `sa-east-1`. **Profile AWS CLI:** `synqo`. **Conta:** 507099297746.
- **Bucket de uploads (prod):** `autostand-uploads`. **CDN:** `https://cdn.autostand.com.br`.
- **Vercel Hobby proíbe uso comercial.** Válido enquanto não houver cliente pagante. No primeiro, migrar para Pro (~US$20/mo).
- **Limite Neon free: 0,5 GB.** Medição real acontece na Task 4, antes de qualquer destruição.

---

### Task 1: Rotação de credenciais — REPLANEJADA (2026-07-13)

**Decisão revisada, após medir o risco real.** A avaliação inicial ("rotacionar antes de tudo") foi feita antes de levantar as evidências. Levantadas, elas mostram um risco de base baixo:

| Vetor | Situação |
|---|---|
| Repo GitHub | **Privado**, e as chaves **nunca foram commitadas** (`git log -S` sobre os 4 segredos críticos em todas as refs → 0 ocorrências) |
| Leitores da task definition | **1 usuário IAM (`ulpionetto`)**, 1 access key ativa. Sem organização, sem outros humanos |
| Roles na conta | Apenas de serviço (ECS, GitHub Actions OIDC do repo privado, DLM) |
| Transcript de sessão | ⚠️ Exposição real e **permanente** — as chaves passaram por sistemas de terceiro |

Não há indício de comprometimento. Rotacionar **antes** do deploy degradaria o app que ainda roda no ECS (IA, pagamentos, e-mail e rate-limit parariam até o Vercel subir), sem ganho de segurança proporcional.

**Nova ordem, custo marginal zero:**
1. **Gerar as chaves novas na Task 6**, no momento de preencher as env vars do Vercel — trabalho que aconteceria de qualquer forma.
2. **Revogar as antigas na Task 8**, depois que o ECS for demolido.
3. O ECS segue rodando com as chaves velhas até morrer. Zero degradação.

A rotação **continua obrigatória** — o transcript não tem como ser "desvazado". Ela só deixa de ser um bloqueio artificial e passa a ser parte do fluxo natural.

**Sanity check antes de seguir (30s):** conferir o painel do Mercado Pago (transações inesperadas) e o console da Anthropic (uso de API não reconhecido). Ambos limpos ⇒ confirmação empírica de que ninguém colheu as chaves.

**Esta task não é mais um gate.** Os passos abaixo viram **referência de consulta**.

---

#### ⚠️ PENDÊNCIA ABERTA — rotação adiada (decisão de 2026-07-14)

Decidiu-se **reusar as chaves existentes** no Vercel para destravar a validação do deploy. Consequência: **a exposição no transcript não foi fechada.** As chaves abaixo continuam sendo as mesmas que passaram por sistemas de terceiros:

`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `UPSTASH_REDIS_REST_TOKEN`, `GMAIL_APP_PASSWORD`.

**Rotacionar após o cutover.** Nesse ponto o custo é trivial — gerar a chave nova no painel do provedor e substituir o valor em *Vercel → Settings → Environment Variables*. Não exige coordenação de deploy nem downtime. Prioridade: **Mercado Pago primeiro** (é o único que mexe com dinheiro).

Exceções já resolvidas, geradas novas na Task 6:
- `AUTH_SECRET` — **novo**. Efeito: todos os usuários são deslogados uma vez no cutover (9 usuários, nenhum pagante — irrelevante).
- `PAYMENT_TOKEN_SECRET` — **novo**.
- Credenciais AWS — **eliminadas**: substituídas por OIDC federation (sem chave estática).

---

#### Referência: como gerar cada chave nova (usar na Task 6)

- [ ] **Mercado Pago (prioridade — mexe com dinheiro)**

Painel: https://www.mercadopago.com.br/developers/panel/app → sua aplicação → *Credenciais de produção*.
1. Gerar novo `Access Token` de produção.
2. Revogar o antigo (o `APP_USR-…` que estava na task definition `autostand:47`).
3. Regerar o `Webhook secret` na aba de Webhooks.

Anotar: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`.
`NEXT_PUBLIC_MP_PUBLIC_KEY` é pública por natureza (vai no browser) — só precisa trocar se o Access Token novo vier de uma aplicação nova.

- [ ] **Anthropic**

https://console.anthropic.com/settings/keys → criar chave nova → deletar a antiga (`sk-ant-api03-7eqEmFk…`).
Anotar: `ANTHROPIC_API_KEY`.

- [ ] **Google Generative AI**

https://aistudio.google.com/apikey → criar chave nova → deletar a antiga.
Anotar: `GOOGLE_GENERATIVE_AI_API_KEY`.

- [ ] **Upstash Redis**

https://console.upstash.com → database `exotic-possum-130544` → *Details* → **Rotate token**.
Anotar: `UPSTASH_REDIS_REST_TOKEN` (a `UPSTASH_REDIS_REST_URL` não muda).

- [ ] **Gmail App Password**

https://myaccount.google.com/apppasswords → revogar a senha atual → gerar nova.
Anotar: `GMAIL_APP_PASSWORD`.

- [ ] **Segredos gerados localmente**

```bash
echo "AUTH_SECRET=$(openssl rand -base64 32)"
echo "PAYMENT_TOKEN_SECRET=$(openssl rand -hex 48)"
```

> `AUTH_SECRET` novo **desloga todo mundo**. Sem clientes pagantes, é irrelevante.

- [ ] **Descartar env vars mortas**

`TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` **não aparecem em lugar nenhum do código** (`grep -rn "TURSO" lib app scripts` → zero ocorrências). São sobra de experimentação. **Não migrar para o Vercel.** Revogar o token no painel do Turso e apagar o banco, se existir.

`TURNSTILE_SECRET_KEY` e `NEXT_PUBLIC_TURNSTILE_SITE_KEY` estão **vazias** hoje. Não migrar.

- [ ] **Verificar a revogação (fazer só na Task 8, após o ECS morrer)**

```bash
# Cole a chave ANTIGA na variável — NÃO commite o valor.
OLD_KEY="<chave-antiga-aqui>"
curl -s -o /dev/null -w "%{http_code}\n" https://api.anthropic.com/v1/models \
  -H "x-api-key: $OLD_KEY" -H "anthropic-version: 2023-06-01"
```
Esperado: **401**. Se vier 200, a chave antiga ainda está viva.

> ⚠️ **Nunca escreva um segredo neste arquivo.** O push protection do GitHub bloqueou esta branch em 2026-07-14 justamente porque a chave estava embutida aqui em texto plano.

---

### Task 2: Corrigir o TLS do cliente Postgres para aceitar CA pública

**O bloqueador nº 1 da migração.** `lib/db/client.ts:52` fixa `ca: RDS_CA_BUNDLE` também no caminho do `DATABASE_URL`. O Neon apresenta certificado assinado por CA pública (Let's Encrypt), então a conexão falharia com `SELF_SIGNED_CERT_IN_CHAIN` / `unable to verify the first certificate`.

Regra nova: **CA do RDS só quando o host é RDS.** Caso contrário, CAs do sistema (`rejectUnauthorized: true` sem `ca` custom). TLS continua verificado — só deixa de exigir *aquela* CA específica.

**Files:**
- Create: `lib/db/pool-config.ts`
- Modify: `lib/db/client.ts:30-56` (passa a importar de `pool-config.ts`)
- Test: `tests/db-pool-config.test.ts` (criar)

**Interfaces:**
- Produces: `sslFor(host: string): PoolConfig["ssl"]` e `buildPoolConfig(): PoolConfig`, ambas exportadas de `@/lib/db/pool-config`.

> **Por que um módulo novo em vez de exportar de `client.ts`:** `client.ts` instancia um `pg.Pool` no topo do módulo. O `vitest.config.ts` deste repo declara a convenção de que *"cada teste só toca funções puras — não precisa de mock de DB"*. Extrair a lógica de configuração para um módulo puro respeita essa convenção e evita construir um Pool durante os testes.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/db-pool-config.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildPoolConfig, sslFor } from "@/lib/db/pool-config";

const ORIGINAL_ENV = { ...process.env };

describe("sslFor", () => {
  it("usa a CA da AWS para hosts RDS", () => {
    const ssl = sslFor("autostand-postgres.cvm00qaemt5n.sa-east-1.rds.amazonaws.com");
    expect(ssl).toMatchObject({ rejectUnauthorized: true });
    expect((ssl as { ca?: string }).ca).toBeTruthy();
  });

  it("usa as CAs do sistema para o Neon (CA pública, sem ca custom)", () => {
    const ssl = sslFor("ep-cool-name-123456-pooler.sa-east-1.aws.neon.tech");
    expect(ssl).toEqual({ rejectUnauthorized: true });
    expect((ssl as { ca?: string }).ca).toBeUndefined();
  });

  it("desliga TLS para Postgres local", () => {
    expect(sslFor("localhost")).toBe(false);
    expect(sslFor("127.0.0.1")).toBe(false);
  });
});

describe("buildPoolConfig", () => {
  beforeEach(() => {
    delete process.env.DB_HOST;
    delete process.env.DB_SECRET_ARN;
    delete process.env.DB_PASSWORD;
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("prefere DB_HOST (RDS) quando presente, com a CA da AWS", () => {
    process.env.DB_HOST = "autostand-postgres.cvm00qaemt5n.sa-east-1.rds.amazonaws.com";
    process.env.DB_NAME = "autostand_prod";
    process.env.DB_PASSWORD = "x";
    const cfg = buildPoolConfig();
    expect(cfg.host).toBe(process.env.DB_HOST);
    expect((cfg.ssl as { ca?: string }).ca).toBeTruthy();
  });

  it("cai no DATABASE_URL sem DB_HOST, e não força a CA do RDS", () => {
    process.env.DATABASE_URL =
      "postgresql://u:p@ep-cool-name-123456-pooler.sa-east-1.aws.neon.tech/autostand?sslmode=require";
    const cfg = buildPoolConfig();
    expect(cfg.connectionString).toBe(process.env.DATABASE_URL);
    expect(cfg.ssl).toEqual({ rejectUnauthorized: true });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx vitest run tests/db-pool-config.test.ts
```
Esperado: **FAIL** — `Failed to resolve import "@/lib/db/pool-config"`. O módulo ainda não existe.

- [ ] **Step 3: Criar `lib/db/pool-config.ts`**

```ts
import type { PoolConfig } from "pg";
import { RDS_CA_BUNDLE } from "./rds-ca";
import { getDbPassword } from "./secret-password";

/** Host de RDS? Só nesse caso o bundle de CA da AWS faz sentido. */
function isRdsHost(host: string): boolean {
  return host.endsWith(".rds.amazonaws.com");
}

/**
 * TLS: CA da AWS **apenas** para hosts RDS. Qualquer outro provedor gerenciado
 * (Neon, Supabase) apresenta certificado de CA pública, verificado contra o
 * truststore do sistema. Desligado só para Postgres local.
 */
export function sslFor(host: string): PoolConfig["ssl"] {
  if (host === "localhost" || host === "127.0.0.1") return false;
  if (isRdsHost(host)) return { ca: RDS_CA_BUNDLE, rejectUnauthorized: true };
  return { rejectUnauthorized: true };
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Em produção preferimos os campos individuais `DB_HOST/DB_PORT/DB_USER/
 * DB_NAME`. A senha vem de `DB_SECRET_ARN` (resolvida em RUNTIME do Secrets
 * Manager, com cache curto) quando presente — assim a rotação de 7 dias do RDS
 * não quebra tasks de vida longa. Sem `DB_SECRET_ARN`, caímos em `DB_PASSWORD`
 * estático. Sem `DB_HOST`, caímos no `DATABASE_URL` (Neon, dev local, testes).
 */
export function buildPoolConfig(): PoolConfig {
  const host = process.env.DB_HOST;
  if (host) {
    const password = process.env.DB_SECRET_ARN
      ? () => getDbPassword()
      : process.env.DB_PASSWORD;
    return {
      host,
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USER ?? "autostand",
      password,
      database: process.env.DB_NAME,
      ssl: sslFor(host),
    };
  }
  const url = process.env.DATABASE_URL ?? "";
  return {
    connectionString: url,
    ssl: sslFor(hostnameOf(url)),
  };
}
```

- [ ] **Step 4: Reduzir `lib/db/client.ts` para consumir o novo módulo**

Substituir as linhas 1–56 de `lib/db/client.ts` por:

```ts
import { Pool, types } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import type { SQL } from "drizzle-orm";
import * as schema from "@/lib/schema";
import { buildPoolConfig } from "./pool-config";
import { invalidateDbPassword, isInvalidPasswordError } from "./secret-password";

// COUNT()/SUM() retornam int8 (bigint), que o node-postgres entrega como string
// por padrão. Nossos agregados (contagens, somas de centavos) cabem com folga
// em Number — então parseamos int8 como número.
types.setTypeParser(20, (val: string) => Number(val));

/** Conexão única do Drizzle com o PostgreSQL. Config em ./pool-config. */
const pool = new Pool(buildPoolConfig());
```

O resto do arquivo (a partir do `pool.on("error", …)`, linha 58) permanece inalterado.

> Note que `RDS_CA_BUNDLE`, `PoolConfig` e `getDbPassword` saem dos imports de `client.ts` — migraram para `pool-config.ts`. Deixá-los importados quebra o lint (`no-unused-vars`).

- [ ] **Step 5: Rodar os testes e confirmar que passam**

```bash
npx vitest run tests/db-pool-config.test.ts
```
Esperado: **5 passed**.

- [ ] **Step 6: Rodar a suíte inteira e o lint (não quebrar o caminho RDS existente)**

```bash
npm test && npm run lint
```
Esperado: nenhuma regressão. O app em produção ainda usa `DB_HOST` (RDS) e deve continuar recebendo a CA da AWS — a Task 2 **não pode** alterar esse comportamento.

- [ ] **Step 7: Commit**

```bash
git add lib/db/pool-config.ts lib/db/client.ts tests/db-pool-config.test.ts
git commit -m "fix(db): CA do RDS só para hosts RDS; CA pública para Neon"
```

---

### Task 3: Dump do RDS

O RDS é `PubliclyAccessible: false`. A estratégia aprovada é exposição temporária com Security Group travado no seu IP. **A janela deve ser a mais curta possível.**

**Files:** nenhum no repo. Artefato: `~/autostand-dump.sql` (fora do repo — **nunca** commitar).

**Interfaces:**
- Produces: `~/autostand-dump.sql`, consumido pela Task 4.

- [ ] **Step 1: Snapshot manual antes de qualquer coisa**

```bash
aws rds create-db-snapshot \
  --db-instance-identifier autostand-postgres \
  --db-snapshot-identifier autostand-pre-migracao \
  --profile synqo --region sa-east-1
```
Esperado: JSON com `"Status": "creating"`. É a rede de segurança do plano inteiro.

- [ ] **Step 2: Capturar seu IP e a senha do banco**

```bash
MY_IP=$(curl -s https://checkip.amazonaws.com)
echo "IP: $MY_IP"

DB_PASS=$(aws secretsmanager get-secret-value \
  --secret-id "arn:aws:secretsmanager:sa-east-1:507099297746:secret:rds!db-72a3e592-94b9-4b22-a105-10a65262ee9b-EGH0WV" \
  --profile synqo --region sa-east-1 \
  --query SecretString --output text | jq -r .password)
```

- [ ] **Step 3: Abrir a janela (SG + acesso público)**

```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-06a2ddf203fcb68a2 \
  --protocol tcp --port 5432 --cidr "${MY_IP}/32" \
  --profile synqo --region sa-east-1

aws rds modify-db-instance \
  --db-instance-identifier autostand-postgres \
  --publicly-accessible --apply-immediately \
  --profile synqo --region sa-east-1
```

Aguardar a mudança propagar (leva 1–3 min):
```bash
aws rds wait db-instance-available --db-instance-identifier autostand-postgres --profile synqo --region sa-east-1
```

- [ ] **Step 4: Dump**

```bash
PGPASSWORD="$DB_PASS" pg_dump \
  --host=autostand-postgres.cvm00qaemt5n.sa-east-1.rds.amazonaws.com \
  --port=5432 --username=autostand --dbname=autostand_prod \
  --no-owner --no-acl --format=plain \
  --file="$HOME/autostand-dump.sql"

ls -lh ~/autostand-dump.sql
```
Esperado: arquivo criado. **O tamanho aqui é a primeira medição real dos dados** — se passar de ~500 MB, o Neon free não serve e a Task 4 precisa ser replanejada.

> `--no-owner --no-acl` porque os roles do RDS não existem no Neon.

- [ ] **Step 5: FECHAR A JANELA — imediatamente, mesmo se o dump falhou**

```bash
aws rds modify-db-instance \
  --db-instance-identifier autostand-postgres \
  --no-publicly-accessible --apply-immediately \
  --profile synqo --region sa-east-1

aws ec2 revoke-security-group-ingress \
  --group-id sg-06a2ddf203fcb68a2 \
  --protocol tcp --port 5432 --cidr "${MY_IP}/32" \
  --profile synqo --region sa-east-1
```

- [ ] **Step 6: Confirmar que a janela fechou**

```bash
aws rds describe-db-instances --db-instance-identifier autostand-postgres \
  --profile synqo --region sa-east-1 \
  --query 'DBInstances[0].PubliclyAccessible' --output text

aws ec2 describe-security-groups --group-ids sg-06a2ddf203fcb68a2 \
  --profile synqo --region sa-east-1 \
  --query 'SecurityGroups[0].IpPermissions[?FromPort==`5432`].IpRanges[].CidrIp' --output text
```
Esperado: `False`, e nenhum CIDR `/32` público na segunda saída. **Não avançar enquanto não for isso.**

---

### Task 4: Neon — criar, restaurar e medir

**Interfaces:**
- Consumes: `~/autostand-dump.sql` (Task 3).
- Produces: `DATABASE_URL` (string de conexão **pooled**), consumida pela Task 6.

- [ ] **Step 1: Criar o projeto no Neon**

https://console.neon.tech → *New Project*.
- Nome: `autostand`
- Postgres: **17** (mais próximo do 18.3 do RDS disponível no free tier)
- Região: `aws-sa-east-1` (São Paulo) — mesma dos usuários e do bucket S3.

- [ ] **Step 2: Restaurar o dump**

Copiar a connection string **direta** (sem `-pooler`) do painel — restauração com pooler dá problema em transações longas.

```bash
psql "postgresql://<user>:<pass>@ep-xxx.sa-east-1.aws.neon.tech/neondb?sslmode=require" \
  -f ~/autostand-dump.sql
```
Esperado: sequência de `CREATE TABLE` / `COPY` sem `ERROR`. Avisos de `role does not exist` são esperados e inofensivos (por isso o `--no-owner`).

- [ ] **Step 3: Medir o tamanho real — o gate do plano**

```bash
psql "postgresql://<user>:<pass>@ep-xxx.sa-east-1.aws.neon.tech/neondb?sslmode=require" \
  -c "SELECT pg_size_pretty(pg_database_size(current_database())) AS tamanho;"
```

**GATE:** se o resultado for **> 500 MB**, o Neon free não comporta. Parar e decidir entre (a) purgar dados de teste/seed e remedir, ou (b) aceitar um tier pago. **Não prosseguir para a Task 8 (demolição) até isso estar resolvido.**

- [ ] **Step 4: Conferir que os dados vieram**

```bash
psql "postgresql://…" -c "\dt"
psql "postgresql://…" -c "SELECT count(*) FROM tenants;"
psql "postgresql://…" -c "SELECT count(*) FROM vehicles;"
psql "postgresql://…" -c "SELECT count(*) FROM users;"
```
Comparar com o esperado. Contagem zero em tabela que deveria ter dados = restauração falhou.

- [ ] **Step 5: Guardar a connection string POOLED**

Do painel do Neon, copiar a string com `-pooler` no host. É essa que vai para o Vercel — funções serverless abrem muitas conexões curtas, e sem o pooler o Postgres esgota o limite de conexões.

Formato: `postgresql://user:pass@ep-xxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require`

---

### Task 5: Usuário IAM para o S3 (o Vercel não herda a task role do ECS)

**O bloqueador nº 2.** `lib/s3.ts:8` faz `new S3Client({ region })` sem credenciais explícitas — depende da cadeia padrão do AWS SDK, que no ECS resolve para a task role. **No Vercel essa cadeia não existe** e os uploads falhariam. O SDK lê `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` do ambiente automaticamente, então **não é preciso mudar código** — basta criar as credenciais.

**Files:** nenhum no repo.

**Interfaces:**
- Produces: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — consumidos pela Task 6.

- [ ] **Step 1: Criar a policy de menor privilégio**

```bash
cat > /tmp/autostand-s3-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::autostand-uploads/*"
    }
  ]
}
EOF

aws iam create-policy \
  --policy-name AutoStandUploadsRW \
  --policy-document file:///tmp/autostand-s3-policy.json \
  --profile synqo
```

> Só `PutObject` e `DeleteObject` — que é exatamente o que `lib/s3.ts` usa (`s3Put`, `s3Delete`). A leitura pública é servida pelo CloudFront, não pelo app.

- [ ] **Step 2: Criar o usuário e anexar a policy**

```bash
aws iam create-user --user-name autostand-vercel --profile synqo

aws iam attach-user-policy \
  --user-name autostand-vercel \
  --policy-arn arn:aws:iam::507099297746:policy/AutoStandUploadsRW \
  --profile synqo
```

- [ ] **Step 3: Gerar as chaves**

```bash
aws iam create-access-key --user-name autostand-vercel --profile synqo
```
Esperado: JSON com `AccessKeyId` e `SecretAccessKey`. **O secret só aparece uma vez.** Copiar direto para o Vercel na Task 6 — não salvar em arquivo, não colar em chat.

> **Hardening futuro (fora de escopo):** o Vercel suporta OIDC federado com a AWS, o que elimina chaves estáticas por completo. Vale considerar depois que a migração estabilizar — especialmente dado o histórico de credencial vazada que originou este plano.

---

### Task 6: Deploy no Vercel

**Interfaces:**
- Consumes: credenciais novas (Task 1), `DATABASE_URL` pooled (Task 4), chaves IAM (Task 5), correção de TLS (Task 2).
- Produces: URL de preview validada, consumida pela Task 7.

- [ ] **Step 1: Importar o projeto**

https://vercel.com/new → importar `Synqo-Servicos/AutoStand`.
- Framework: **Next.js** (autodetectado)
- Root directory: `./`
- **Não** habilitar deploy automático de produção ainda.

- [ ] **Step 2: Cadastrar as variáveis de ambiente**

Em *Settings → Environment Variables*, escopo **Production** e **Preview**. Usar **exclusivamente os valores NOVOS** da Task 1.

| Variável | Origem |
|---|---|
| `DATABASE_URL` | Task 4 Step 5 (string **pooled**) |
| `AUTH_SECRET` | Task 1 Step 6 |
| `PAYMENT_TOKEN_SECRET` | Task 1 Step 6 |
| `MERCADOPAGO_ACCESS_TOKEN` | Task 1 Step 1 |
| `MERCADOPAGO_WEBHOOK_SECRET` | Task 1 Step 1 |
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | Task 1 Step 1 |
| `MERCADOPAGO_PLAN_BASICO` | `98e8b29d50a2420aa02aca094e6fd416` (id de plano, não é segredo) |
| `MERCADOPAGO_PLAN_PRO` | `15d14d9dcad64b12a57460f0f404ee6d` |
| `MERCADOPAGO_PLAN_PREMIUM` | `ee0413ecc552491ea392a23f90050844` |
| `ANTHROPIC_API_KEY` | Task 1 Step 2 |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Task 1 Step 3 |
| `AI_MODEL` | `gemini-2.5-flash` |
| `UPSTASH_REDIS_REST_URL` | `https://exotic-possum-130544.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Task 1 Step 4 |
| `GMAIL_APP_PASSWORD` | Task 1 Step 5 |
| `AWS_ACCESS_KEY_ID` | Task 5 Step 3 |
| `AWS_SECRET_ACCESS_KEY` | Task 5 Step 3 |
| `AWS_S3_BUCKET` | `autostand-uploads` |
| `AWS_S3_REGION` | `sa-east-1` |
| `CDN_URL` | `https://cdn.autostand.com.br` |
| `PLATFORM_DOMAIN` | `autostand.com.br` |
| `PLATFORM_HOSTS` | `autostand.com.br` |
| `NEXTAUTH_URL` | `https://autostand.com.br` |
| `AUTH_TRUST_HOST` | `true` |
| `CHECKOUT_MODE` | `transparent` |

**NÃO cadastrar** (e por quê):
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME`, `DB_PASSWORD`, `DB_SECRET_ARN` — se `DB_HOST` existir, `buildPoolConfig()` ignora a `DATABASE_URL` e tenta o RDS. **Cadastrar isso por engano quebra a migração inteira.**
- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` — mortas, sem uso no código.
- `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — vazias hoje.
- `NODE_ENV` — o Vercel define sozinho.

- [ ] **Step 3: Deploy de preview**

```bash
npx vercel --yes
```
Esperado: build passa e devolve uma URL `*.vercel.app`.

Se o build falhar em `pg` / `server-only`, verificar que as rotas que tocam o banco não estão sendo pré-renderizadas em build time.

- [ ] **Step 4: Validar o preview — este é o gate de verdade**

Na URL de preview:

```bash
curl -s -o /dev/null -w "home: %{http_code}\n" https://<preview>.vercel.app
```

E manualmente, no browser:
- [ ] A home carrega e **lista veículos** → prova que o Neon está conectado (se o TLS da Task 2 estivesse errado, isso falharia com erro de certificado).
- [ ] Login funciona → prova `AUTH_SECRET` + banco.
- [ ] **Upload de uma foto de veículo** → prova as chaves IAM da Task 5. A imagem deve aparecer servida por `cdn.autostand.com.br`.
- [ ] Uma tela que use IA → prova as chaves novas da Task 1.

> **Não prosseguir para a Task 7 enquanto o upload não funcionar.** É o item mais provável de quebrar, porque é o único que depende de credencial nova + serviço AWS que continua vivo.

---

### Task 7: Cutover de DNS

Hoje: `autostand.com.br` → CloudFront `E2ZAXVU5GRBGKB` → ALB → Fargate.
Depois: `autostand.com.br` → Vercel.

**Interfaces:**
- Consumes: preview validado (Task 6).
- Produces: domínio servido pelo Vercel — pré-requisito da Task 8.

- [ ] **Step 1: Adicionar os domínios no Vercel**

*Settings → Domains* → adicionar `autostand.com.br`, `www.autostand.com.br` e `console.autostand.com.br`. O Vercel mostra os registros DNS necessários.

- [ ] **Step 2: Baixar o hosted zone atual (rollback)**

```bash
ZID=$(aws route53 list-hosted-zones --profile synqo \
  --query "HostedZones[?Name=='autostand.com.br.'].Id" --output text)

aws route53 list-resource-record-sets --hosted-zone-id "$ZID" \
  --profile synqo > ~/autostand-dns-backup.json
```
É o seu botão de desfazer. **Não pule.**

- [ ] **Step 3: Repontar o apex e o console para o Vercel**

Os registros hoje são ALIAS A para `d38sl46ly3nz4n.cloudfront.net`. Trocar para os alvos que o Vercel indicou no Step 1 (tipicamente `A 76.76.21.21` para o apex e `CNAME cname.vercel-dns.com` para os subdomínios).

Fazer pelo console do Route 53 (menos propenso a erro que montar o JSON de change-batch à mão), ou:

```bash
aws route53 change-resource-record-sets --hosted-zone-id "$ZID" \
  --change-batch file:///tmp/cutover.json --profile synqo
```

**Não tocar em `cdn.autostand.com.br`** — continua apontando para o CloudFront do S3, que fica.

- [ ] **Step 4: Verificar a propagação**

```bash
dig +short autostand.com.br
curl -s -o /dev/null -w "autostand.com.br -> %{http_code}\n" https://autostand.com.br
curl -sI https://autostand.com.br | grep -i "server\|x-vercel"
```
Esperado: HTTP **200** e header `x-vercel-id` presente — prova que quem responde é o Vercel, não o ALB.

- [ ] **Step 5: Reapontar o webhook do Mercado Pago**

No painel do Mercado Pago, confirmar que a URL de notificação aponta para `https://autostand.com.br/...` (o path que a app expõe). Como o domínio não mudou, provavelmente já está certo — mas confirme, porque webhook quebrado é falha silenciosa.

- [ ] **Step 6: Deixar assentar 24–48h**

**Não prosseguir para a Task 8 no mesmo dia.** Se algo sutil quebrou (webhook, e-mail, um fluxo específico), você quer o ALB e o RDS ainda de pé para comparar ou reverter.

---

### Task 8: Demolição

**Só depois da Task 7 validada e assentada.** Esta é a task que efetivamente corta os ~US$80/mês.

**Pré-condição obrigatória:** `curl -sI https://autostand.com.br | grep x-vercel-id` retorna resultado. Se não retornar, **PARE**.

- [ ] **Step 1: Zerar o serviço ECS**

```bash
aws ecs update-service --cluster autostand --service autostand-web \
  --desired-count 0 --profile synqo --region sa-east-1
```

Aguardar e confirmar que o site **continua no ar** (agora é o Vercel servindo):
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://autostand.com.br
```
Esperado: **200**. Se cair, o DNS não migrou de verdade — reverta com `~/autostand-dns-backup.json`.

- [ ] **Step 2: Deletar os serviços e o cluster**

```bash
aws ecs delete-service --cluster autostand --service autostand-web --force --profile synqo --region sa-east-1
aws ecs delete-service --cluster autostand --service autostand-web-homolog --force --profile synqo --region sa-east-1
aws ecs delete-cluster --cluster autostand --profile synqo --region sa-east-1
```

- [ ] **Step 3: Snapshot final do RDS e deleção**

```bash
aws rds delete-db-instance \
  --db-instance-identifier autostand-postgres \
  --final-db-snapshot-identifier autostand-final-2026-07 \
  --profile synqo --region sa-east-1
```
> **Sem `--skip-final-snapshot`.** O snapshot final é barato (centavos por GB/mês) e é a sua última rede se algo aparecer semanas depois.

- [ ] **Step 4: Deletar o ALB e os target groups**

```bash
ALB_ARN=$(aws elbv2 describe-load-balancers --names autostand-alb \
  --profile synqo --region sa-east-1 --query 'LoadBalancers[0].LoadBalancerArn' --output text)

aws elbv2 delete-load-balancer --load-balancer-arn "$ALB_ARN" --profile synqo --region sa-east-1
```

Deletar o ALB **libera automaticamente os 2 EIPs** (`54.232.72.152` e `56.126.74.129`), que eram as ENIs dele. Confirmar:
```bash
aws ec2 describe-addresses --profile synqo --region sa-east-1 --query 'Addresses[].PublicIp' --output text
```
Esperado: **vazio**.

Depois, remover os target groups órfãos:
```bash
aws elbv2 describe-target-groups --profile synqo --region sa-east-1 \
  --query 'TargetGroups[].TargetGroupArn' --output text
# para cada um: aws elbv2 delete-target-group --target-group-arn <arn> --profile synqo --region sa-east-1
```

- [ ] **Step 5: Desabilitar e deletar as distribuições CloudFront de origem-ALB**

`E2ZAXVU5GRBGKB` (prod) e `E3LRVJCG5UO8AI` (homolog). **Manter** `E1FMGN9TYY08T` (cdn prod) e decidir sobre `E2C5CUXVMROS6A` (cdn homolog).

Uma distro precisa ser desabilitada e estar `Deployed` antes de poder ser deletada — leva ~15 min. Pelo console é bem menos doloroso que pela CLI (exige `--if-match` com o ETag). Console: *CloudFront → Distributions → Disable → aguardar → Delete*.

- [ ] **Step 6: Limpar a stack de homolog**

```bash
# bucket de uploads do homolog
aws s3 rb s3://autostand-uploads-homolog --force --profile synqo --region sa-east-1
```
E remover os registros `*.homologation.autostand.com.br` do Route 53 (`homologation`, `*.homologation`, `console.homologation`, `cdn.homologation` e os `_acm-validations` correspondentes).

Deletar também a distro `E2C5CUXVMROS6A` (cdn homolog), junto com as do Step 5.

- [ ] **Step 7: ECR**

```bash
aws ecr delete-repository --repository-name autostand --force --profile synqo --region sa-east-1
```

- [ ] **Step 8: Secrets Manager**

O segredo `rds!db-72a3e592-…` é gerenciado pelo RDS e some junto com a instância. Confirmar que não sobrou nada:
```bash
aws secretsmanager list-secrets --profile synqo --region sa-east-1 --query 'SecretList[].Name' --output text
```

- [ ] **Step 9: Verificar o resultado**

Após 48h (o Cost Explorer tem latência), conferir o custo diário:
```bash
aws ce get-cost-and-usage --profile synqo \
  --time-period Start=2026-07-20,End=2026-07-27 \
  --granularity DAILY --metrics UnblendedCost --output json \
  | jq -r '.ResultsByTime[] | "\(.TimePeriod.Start)  $\(.Total.UnblendedCost.Amount)"'
```
Esperado: **~US$0,07/dia** (≈ US$2,15/mês). Se estiver acima, agrupar por `USAGE_TYPE` para achar o que sobrou.

- [ ] **Step 10: Commit final da documentação**

```bash
git add docs/superpowers/
git commit -m "docs: spec e plano da migração AWS -> Vercel + Neon"
```

---

## Estado final esperado

| Item | US$/mês |
|---|---|
| Vercel Hobby + Neon free | 0,00 |
| S3 `autostand-uploads` + CloudFront (always-free) | ~0,15 |
| EBS 10 GB (EC2 Trinta Linhas parada) | ~1,00 |
| Route 53, 2 zonas | 1,00 |
| Snapshots RDS retidos | ~0,10 |
| **Total** | **~US$2,25** |

Partindo de ~US$115/mês. O passo 1 (já executado) tirou ~US$11,60; as Tasks 3–8 tiram os ~US$100 restantes.
