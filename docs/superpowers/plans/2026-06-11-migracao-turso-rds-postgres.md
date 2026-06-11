# Migração Turso → RDS PostgreSQL (conta Synqo)

> **Objetivo:** sair do Turso (libSQL/SQLite) e da dependência de terceiros para um
> banco **RDS PostgreSQL** dentro da conta **Synqo (CNPJ `507099297746`)**, onde a
> infra do AutoStand já roda. Meta: stack 100% AWS-native.

**Status:** Em andamento — iniciado em 2026-06-11.

---

## Contexto

- A infra (ECS `autostand`, ALB `autostand-alb`, ECR, S3) **já está na conta Synqo** (`507099297746`, profile `autostand`, região `sa-east-1`). Não foi criada na conta errada.
- DB hoje: **Turso** via `@libsql/client` + Drizzle `sqlite-core`.
- **RDS já provisionado**: `autostand-postgres` (Postgres 18, `db.t4g.micro`, 20GB gp3, privado, db `autostand`, senha gerenciada no Secrets Manager, SG `sg-06a2ddf203fcb68a2` liberando o SG do ECS `sg-01e9e2ec9a6929544` na 5432, subnet group `autostand-db-subnets`, deletion protection on).
- VPC `vpc-00e3d7032cdd2f0f0`; ECS em subnets públicas (sa-east-1a/b/c) com IP público.

---

## Fase 1 — Port do código (Drizzle `sqlite-core` → `pg-core`)

Independe do RDS estar pronto. Resulta num PR verificável (`tsc` + build).

| Arquivo | Ação |
|---|---|
| `lib/schema.ts` | `sqlite-core` → `pg-core`. `sqliteTable`→`pgTable`; PK `integer.autoIncrement`→`integer().generatedAlwaysAsIdentity()`; `integer{mode:boolean}`→`boolean`; `text{mode:json}`→`jsonb`; timestamps mantidos como `text` com default `(CURRENT_TIMESTAMP)::text` (menor churn no app, que lê datas como string). |
| `lib/db/client.ts` | `@libsql/client` + `drizzle-orm/libsql` → `pg` (`Pool`) + `drizzle-orm/node-postgres`. Lê `DATABASE_URL` (postgres://...). |
| `lib/db/tenants.ts` | `db.all(sql)`/`db.get(sql)` (API SQLite) → `db.execute(sql)` (`.rows`). `set({ updated_at: sql\`CURRENT_TIMESTAMP\` })` → `(CURRENT_TIMESTAMP)::text`. |
| demais `lib/db/*.ts` | varrer por `db.all`/`db.get`/`db.run`, `CURRENT_TIMESTAMP`, `LIKE`, `PRAGMA`. `.returning()` funciona no PG. |
| `drizzle.config.ts` | `dialect: "turso"` → `"postgresql"`; `dbCredentials.url` = `DATABASE_URL`. |
| `scripts/migrate.ts` | `drizzle-orm/libsql/migrator` → `drizzle-orm/node-postgres/migrator`. |
| `drizzle/` | arquivar migrações SQLite (`drizzle/_sqlite-archive/`) e gerar baseline PG novo (`drizzle-kit generate`). |
| `package.json` | remover `@libsql/client`; add `pg` + `@types/pg`. |
| `.env*.local` | `DATABASE_URL` Postgres (local: container PG ou a própria RDS via janela temporária). |

**Verificação:** `npx tsc --noEmit`, `npm test`, `npm run build`, e `drizzle-kit generate` produzindo um baseline PG limpo.

## Fase 2 — Aplicar schema + migrar dados

- **Acesso:** o RDS é privado. Opções para rodar migração/import:
  1. Adicionar passo de **migração no deploy** (task one-off Fargate rodando `db:migrate`) — recomendado, também cobre a lacuna atual (deploys não migram).
  2. Janela temporária: `--publicly-accessible` + SG liberando meu IP, rodar, e travar de volta.
- Aplicar o baseline PG na RDS.
- **Migração de dados** Turso → Postgres (volume pequeno: poucos tenants/veículos/leads). Exportar do Turso e inserir no PG respeitando FKs e tipos (boolean, jsonb).

## Fase 3 — Wiring (ECS + secrets) e deploy

- Montar `DATABASE_URL` a partir do segredo do RDS (Secrets Manager) — de preferência referência de secret no task def, não valor cru.
- Atualizar task def do ECS (homolog + prod) e o secret no GitHub Actions.
- Deploy homolog (auto no merge) → validar → deploy prod (manual).

## Fase 4 — Desligar Turso

- Após validação em prod, remover o banco no Turso e quaisquer vars/credenciais.
- (Opcional, fora de escopo imediato) avaliar trocar **Upstash Redis** (rate-limit) por ElastiCache para zerar terceiros.

---

## Rollback

- Fase 1 é só código num PR — reverter o PR volta ao Turso.
- Enquanto o Turso não for desligado (Fase 4), é possível reapontar `DATABASE_URL` de volta para o Turso e redeployar.
- RDS tem deletion protection + backups (7 dias / PITR).
