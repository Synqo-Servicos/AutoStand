import { Pool, types, type PoolConfig } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import type { SQL } from "drizzle-orm";
import * as schema from "@/lib/schema";
import { RDS_CA_BUNDLE } from "./rds-ca";

// COUNT()/SUM() retornam int8 (bigint), que o node-postgres entrega como string
// por padrão. Nossos agregados (contagens, somas de centavos) cabem com folga
// em Number — então parseamos int8 como número.
types.setTypeParser(20, (val: string) => Number(val));

/**
 * Conexão única do Drizzle com o PostgreSQL (RDS).
 *
 * Em produção/homolog preferimos os campos individuais `DB_HOST/DB_PORT/
 * DB_USER/DB_NAME` + `DB_PASSWORD` — este último injetado pelo ECS a partir
 * do Secrets Manager (senha gerenciada do RDS), então cada task pega sempre
 * a senha ATUAL e a rotação de 7 dias deixa de quebrar o deploy. Sem
 * `DB_HOST`, caímos no `DATABASE_URL` (dev local e testes) — retrocompatível.
 *
 * TLS verificado contra a CA oficial do RDS; desligado só para Postgres local.
 */
function buildPoolConfig(): PoolConfig {
  const host = process.env.DB_HOST;
  if (host) {
    const isLocal = host === "localhost" || host === "127.0.0.1";
    return {
      host,
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USER ?? "autostand",
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: isLocal ? false : { ca: RDS_CA_BUNDLE, rejectUnauthorized: true },
    };
  }
  const url = process.env.DATABASE_URL ?? "";
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  return {
    connectionString: url,
    ssl: isLocal ? false : { ca: RDS_CA_BUNDLE, rejectUnauthorized: true },
  };
}

const pool = new Pool(buildPoolConfig());

export const db = drizzle(pool, { schema });
export const client = pool;

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Query SQL crua → todas as linhas. Substitui o `db.all()` do libSQL. */
export async function dbAll<T = Record<string, unknown>>(query: SQL): Promise<T[]> {
  const res = await db.execute(query);
  return res.rows as T[];
}

/** Query SQL crua → primeira linha (ou undefined). Substitui o `db.get()`. */
export async function dbGet<T = Record<string, unknown>>(query: SQL): Promise<T | undefined> {
  const res = await db.execute(query);
  return res.rows[0] as T | undefined;
}
