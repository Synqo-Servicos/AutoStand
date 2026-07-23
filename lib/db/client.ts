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
