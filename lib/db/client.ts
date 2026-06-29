import { Pool, types, type PoolConfig } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import type { SQL } from "drizzle-orm";
import * as schema from "@/lib/schema";
import { RDS_CA_BUNDLE } from "./rds-ca";
import {
  getDbPassword,
  invalidateDbPassword,
  isInvalidPasswordError,
} from "./secret-password";

// COUNT()/SUM() retornam int8 (bigint), que o node-postgres entrega como string
// por padrão. Nossos agregados (contagens, somas de centavos) cabem com folga
// em Number — então parseamos int8 como número.
types.setTypeParser(20, (val: string) => Number(val));

/**
 * Conexão única do Drizzle com o PostgreSQL (RDS).
 *
 * Em produção/homolog preferimos os campos individuais `DB_HOST/DB_PORT/
 * DB_USER/DB_NAME`. A senha vem de `DB_SECRET_ARN` (resolvida em RUNTIME do
 * Secrets Manager, com cache curto) quando presente — assim a rotação de 7
 * dias do RDS não quebra tasks de vida longa: uma conexão nova após o cache
 * vencer já usa a senha atual, sem precisar de restart. Sem `DB_SECRET_ARN`
 * caímos em `DB_PASSWORD` estático (retrocompat). Sem `DB_HOST`, caímos no
 * `DATABASE_URL` (dev local e testes).
 *
 * TLS verificado contra a CA oficial do RDS; desligado só para Postgres local.
 */
function buildPoolConfig(): PoolConfig {
  const host = process.env.DB_HOST;
  if (host) {
    const isLocal = host === "localhost" || host === "127.0.0.1";
    // Com DB_SECRET_ARN, `password` é uma função async que o pg chama a cada
    // conexão nova — é por aí que a senha rotacionada entra sem restart.
    const password = process.env.DB_SECRET_ARN
      ? () => getDbPassword()
      : process.env.DB_PASSWORD;
    return {
      host,
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USER ?? "autostand",
      password,
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

// Se uma conexão falhar por senha inválida (28P01), a senha provavelmente
// rotacionou: invalida o cache para que a próxima conexão busque a atual.
pool.on("error", (err) => {
  if (isInvalidPasswordError(err)) invalidateDbPassword();
});

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
