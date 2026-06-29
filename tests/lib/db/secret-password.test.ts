import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock do SDK do Secrets Manager. mockSend é o `send` do client.
const mockSend = vi.fn();

vi.mock("@aws-sdk/client-secrets-manager", () => {
  // Funções normais (não arrow) para poderem ser usadas com `new`.
  function SecretsManagerClient() {
    return { send: mockSend };
  }
  function GetSecretValueCommand(input: unknown) {
    return { input };
  }
  return { SecretsManagerClient, GetSecretValueCommand };
});

function secretJson(password: string) {
  return {
    SecretString: JSON.stringify({
      username: "autostand",
      password,
      engine: "postgres",
      host: "autostand-postgres.example.rds.amazonaws.com",
      port: 5432,
    }),
  };
}

describe("lib/db/secret-password", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSend.mockReset();
    delete process.env.DB_SECRET_ARN;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_SECRET_TTL_MS;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("busca o segredo no SM e retorna o campo .password do JSON", async () => {
    process.env.DB_SECRET_ARN = "arn:test:secret";
    mockSend.mockResolvedValue(secretJson("senha-atual"));

    const { getDbPassword } = await import("@/lib/db/secret-password");
    await expect(getDbPassword()).resolves.toBe("senha-atual");
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("cacheia dentro do TTL: chamadas repetidas batem no SM uma vez só", async () => {
    process.env.DB_SECRET_ARN = "arn:test:secret";
    process.env.DB_SECRET_TTL_MS = "60000";
    mockSend.mockResolvedValue(secretJson("p1"));

    const { getDbPassword } = await import("@/lib/db/secret-password");
    await getDbPassword();
    await getDbPassword();
    await getDbPassword();
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("refaz o fetch depois que o TTL expira", async () => {
    vi.useFakeTimers();
    process.env.DB_SECRET_ARN = "arn:test:secret";
    process.env.DB_SECRET_TTL_MS = "60000";
    mockSend.mockResolvedValue(secretJson("p1"));

    const { getDbPassword } = await import("@/lib/db/secret-password");
    await getDbPassword();
    expect(mockSend).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(61_000);
    await getDbPassword();
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("invalidateDbPassword() força refetch na próxima chamada", async () => {
    process.env.DB_SECRET_ARN = "arn:test:secret";
    process.env.DB_SECRET_TTL_MS = "60000";
    mockSend.mockResolvedValue(secretJson("p1"));

    const mod = await import("@/lib/db/secret-password");
    await mod.getDbPassword();
    mod.invalidateDbPassword();
    await mod.getDbPassword();
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("sem DB_SECRET_ARN: usa DB_PASSWORD e nunca chama o SM", async () => {
    process.env.DB_PASSWORD = "senha-local";
    const { getDbPassword } = await import("@/lib/db/secret-password");
    await expect(getDbPassword()).resolves.toBe("senha-local");
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("falha no fetch do SM: faz fallback para DB_PASSWORD", async () => {
    process.env.DB_SECRET_ARN = "arn:test:secret";
    process.env.DB_PASSWORD = "senha-fallback";
    mockSend.mockRejectedValue(new Error("AccessDenied"));

    const { getDbPassword } = await import("@/lib/db/secret-password");
    await expect(getDbPassword()).resolves.toBe("senha-fallback");
  });

  it("sem ARN e sem DB_PASSWORD: lança erro claro", async () => {
    const { getDbPassword } = await import("@/lib/db/secret-password");
    await expect(getDbPassword()).rejects.toThrow(/DB_SECRET_ARN|DB_PASSWORD/);
  });

  it("isInvalidPasswordError reconhece o código Postgres 28P01", async () => {
    const { isInvalidPasswordError } = await import("@/lib/db/secret-password");
    expect(isInvalidPasswordError({ code: "28P01" })).toBe(true);
    expect(isInvalidPasswordError({ code: "08006" })).toBe(false);
    expect(isInvalidPasswordError(new Error("boom"))).toBe(false);
    expect(isInvalidPasswordError(undefined)).toBe(false);
    expect(isInvalidPasswordError(null)).toBe(false);
  });
});
