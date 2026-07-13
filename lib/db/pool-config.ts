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
