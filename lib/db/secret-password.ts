import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

/**
 * Resolve a senha do Postgres (RDS) em RUNTIME a partir do Secrets Manager.
 *
 * Motivo: o RDS rotaciona a senha gerenciada a cada 7 dias. O ECS resolve
 * `DB_PASSWORD` só no start da task, então uma task de vida longa que atravessa
 * uma rotação fica com a senha velha e toda conexão nova falha
 * (`password authentication failed`). Buscando a senha aqui, com cache curto, o
 * app se recupera sozinho da rotação sem precisar de restart — basta uma
 * conexão nova depois que o cache vence (ou após `invalidateDbPassword()`).
 *
 * Gated em `DB_SECRET_ARN`: sem ele (dev local, testes) caímos em `DB_PASSWORD`.
 */

const DEFAULT_TTL_MS = 60_000;

let cached: { value: string; at: number } | null = null;
let clientSingleton: SecretsManagerClient | null = null;

function ttlMs(): number {
  const raw = Number(process.env.DB_SECRET_TTL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TTL_MS;
}

function client(): SecretsManagerClient {
  if (!clientSingleton) {
    clientSingleton = new SecretsManagerClient({
      region:
        process.env.AWS_REGION ?? process.env.AWS_S3_REGION ?? "sa-east-1",
    });
  }
  return clientSingleton;
}

/** Limpa o cache para forçar refetch na próxima chamada (ex.: após `28P01`). */
export function invalidateDbPassword(): void {
  cached = null;
}

/** Erro Postgres de senha inválida (`28P01`) — sinal de que a senha rotacionou. */
export function isInvalidPasswordError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "28P01"
  );
}

/**
 * Senha atual do banco. Com `DB_SECRET_ARN`, busca/cacheia do Secrets Manager;
 * em falha (ou sem ARN), faz fallback para `DB_PASSWORD`.
 */
export async function getDbPassword(): Promise<string> {
  const arn = process.env.DB_SECRET_ARN;
  if (!arn) {
    const fallback = process.env.DB_PASSWORD;
    if (fallback) return fallback;
    throw new Error(
      "Senha do DB indisponível: defina DB_SECRET_ARN (runtime) ou DB_PASSWORD (local).",
    );
  }

  const now = Date.now();
  if (cached && now - cached.at < ttlMs()) {
    return cached.value;
  }

  try {
    const res = await client().send(
      new GetSecretValueCommand({ SecretId: arn }),
    );
    if (!res.SecretString) throw new Error("SecretString vazio");
    const password = (JSON.parse(res.SecretString) as { password?: string })
      .password;
    if (!password) throw new Error("segredo sem campo .password");
    cached = { value: password, at: now };
    return password;
  } catch (err) {
    // Resiliência: durante rollout ou falha transitória do SM, cai na senha
    // injetada no start (se houver).
    const fallback = process.env.DB_PASSWORD;
    if (fallback) return fallback;
    throw err;
  }
}
