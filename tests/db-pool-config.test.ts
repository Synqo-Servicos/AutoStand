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
