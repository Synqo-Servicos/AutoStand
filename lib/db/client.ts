import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/lib/schema";

/**
 * Conexão única do Drizzle. Aceita os nomes do nosso .env (DATABASE_*) e
 * os que a integração Turso da Vercel injeta (TURSO_*). Sem nenhum dos
 * dois, cai no arquivo SQLite local de desenvolvimento.
 */
const _client = createClient({
  url: process.env.DATABASE_URL ?? process.env.TURSO_DATABASE_URL ?? "file:local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(_client, { schema });
export const client = _client;
