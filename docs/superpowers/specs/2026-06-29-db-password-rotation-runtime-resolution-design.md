# Resolução da senha do DB em runtime (sobreviver à rotação do RDS)

**Data:** 2026-06-29
**Status:** Aprovado (aguardando implementação)

## Problema

O RDS gerencia a senha do usuário `autostand` via Secrets Manager com **rotação a cada 7 dias**. O ECS resolve `DB_PASSWORD` a partir do Secrets Manager **apenas no start da task** (via execution role), e `lib/db/client.ts` lê `process.env.DB_PASSWORD` **uma única vez** (`new Pool(...)`). Resultado: uma task que continua viva atravessando uma rotação mantém a senha antiga e **toda conexão nova ao banco passa a falhar** com `error: password authentication failed for user "autostand"`.

Isso derrubou produção (`autostand.com.br`) e homolog em 2026-06-29: tasks iniciadas em 22/06, segredo rotacionado em 24/06. O app continuava de pé (`/api/health` é raso, retorna 200), mas **toda página que consulta o banco retornava 500**. Correção emergencial aplicada: `aws ecs update-service --force-new-deployment` nos dois serviços.

O design atual só torna **deploys** à prova de rotação — não tasks de vida longa.

## Objetivo

O app em execução deve sobreviver a uma rotação de senha do RDS **sem restart**, resolvendo a senha no momento da conexão (com cache e auto-refresh) em vez de capturá-la em uma env var fixa no start do processo.

## Abordagem escolhida

**Approach A — fetch em runtime do Secrets Manager.** Descartadas: redeploy agendado via EventBridge (janela de erro maior, infra fora do repo) e "não fazer nada" (mantém o outage a cada 7 dias).

Descoberta relevante: as tasks rodam em **Fargate sem nenhum task role** (`taskRoleArn: null`) e sem chaves AWS na env — ou seja, o container **não tem credenciais AWS em runtime** hoje. Criar o task role é pré-requisito desta abordagem e, de quebra, dá ao container as credenciais que `lib/s3.ts` precisa.

## Componentes

### 1. Resolver de senha — `lib/db/secret-password.ts` (novo)

- `getDbPassword(): Promise<string>`
  - Se `DB_SECRET_ARN` estiver setado: busca o segredo gerenciado do RDS via `@aws-sdk/client-secrets-manager`, faz parse do JSON e retorna `.password`.
  - Cacheia o valor com TTL curto (default **60s**, configurável por `DB_SECRET_TTL_MS`). Dentro do TTL, retorna o cache; após o TTL, refaz o fetch.
  - Em falha de fetch: faz fallback para `process.env.DB_PASSWORD` se presente; senão, propaga o erro.
- `invalidateDbPassword(): void` — limpa o cache (força refetch na próxima chamada).

Interface: o módulo conhece só Secrets Manager + env; não conhece `pg`/drizzle. Testável isoladamente com o cliente SM mockado.

### 2. Wiring no pool — `lib/db/client.ts`

- Quando `DB_SECRET_ARN` está setado: passa `password: () => getDbPassword()` ao `pg` Pool (o `pg` suporta nativamente `password` como função async; o drizzle apenas consome o pool).
- Quando **não** está setado: comportamento atual (`DB_PASSWORD` estático no caminho `DB_HOST`, ou `DATABASE_URL` no fallback) — **dev local e testes não mudam**.
- `pool.on('error', ...)`: ao ver código Postgres `28P01` (invalid password), chama `invalidateDbPassword()` para acelerar o self-heal.

**Dinâmica do self-heal:** sessões Postgres autenticam no connect e permanecem válidas; após uma rotação, só **conexões novas** falham. Com TTL de 60s, conexões novas voltam a funcionar em ≤60s automaticamente; a invalidação no `28P01` torna isso mais rápido. Conexões existentes seguem servindo no intervalo. Isso troca "outage total até redeploy manual" por "poucos erros por ≤60s, auto-recuperado".

### 3. IAM — task role `ecsTaskRole-autostand` (novo)

- Trust policy: `ecs-tasks.amazonaws.com`.
- Permissão: `secretsmanager:GetSecretValue` no ARN do segredo do RDS (`arn:aws:secretsmanager:sa-east-1:507099297746:secret:rds!db-72a3e592-94b9-4b22-a105-10a65262ee9b-EGH0WV`).
- `kms:Decrypt` apenas se houver "access denied" (segredo gerenciado do RDS usa a chave AWS-managed `aws/secretsmanager`, que normalmente não exige grant explícito na mesma conta).

### 4. Wiring de deploy — `deploy-homolog.yml` + `deploy-production.yml`

- Adicionar `DB_SECRET_ARN` (ARN hardcoded, como `DB_HOST` já é) ao bloco `environment-variables`.
- Estender o passo `jq` existente para também setar `.taskRoleArn` no task def renderizado, garantindo que o task role persista a cada deploy. Manter a injeção do secret `DB_PASSWORD` como fallback de start.

### 5. Dependência

- Adicionar `@aws-sdk/client-secrets-manager` (consistente com o `@aws-sdk/client-s3` já existente).

### 6. Testes

- Unit do resolver com cliente SM mockado:
  - faz parse de `.password`;
  - cacheia dentro do TTL (1 fetch para N chamadas);
  - refaz fetch após o TTL;
  - `invalidateDbPassword()` força refetch;
  - sem `DB_SECRET_ARN`, não chama SM e usa `DB_PASSWORD`;
  - em falha de fetch, faz fallback para `DB_PASSWORD`.
- Suíte existente roda com `DATABASE_URL` (sem `DB_SECRET_ARN`) — não afetada.

## Sequência de rollout

1. Criar o task role IAM + policy (AWS).
2. App: dependência + resolver + wiring no pool + testes. Commit.
3. Editar os dois workflows (env `DB_SECRET_ARN` + `taskRoleArn` no `jq`).
4. Merge na `main` → homolog faz deploy automático com task role + fetch em runtime. Verificar homolog (200 + logs do caminho do resolver).
5. Rodar o workflow de produção manualmente. Verificar produção.
6. (Prova real, opcional) Rotacionar o segredo de homolog manualmente (`aws secretsmanager rotate-secret`) e confirmar zero downtime.

## Riscos e mitigações

- **Falha transitória do Secrets Manager** → cache reduz chamadas; fallback para `DB_PASSWORD`.
- **Negação IAM/KMS** → verificar após deploy; adicionar `kms:Decrypt` se necessário.
- **Quebrar local/testes** → tudo gated em `DB_SECRET_ARN` (ausente em dev/test).
- **Custo de chamadas SM** → desprezível (GetSecretValue só em conexão nova com cache vencido; ~$0,05/10k chamadas).

## Fora de escopo

- Permissões S3 no novo task role (corrige `lib/s3.ts`, mas é problema separado) — anotado, não incluído por padrão.
- Migração para IaC (task defs/IAM são geridos imperativamente hoje).
