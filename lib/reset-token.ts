import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token de reset de senha — HMAC assinado (mesmo padrão de payment-token.ts),
 * SEM tabela nova. Assinado com AUTH_SECRET (já existe no ambiente).
 *
 * Uso único de fato: o token embute um "fingerprint" da senha atual do usuário.
 * Quando a senha muda (o próprio reset ou outro), o fingerprint deixa de bater
 * → o link morre. Assim um link já usado não redefine a senha de novo.
 */

const TTL_SECONDS = 60 * 60; // 1 hora

interface SignedReset {
  userId: number;
  pf: string; // password fingerprint
  exp: number;
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET não configurado.");
  return s;
}

function nowS(nowSeconds?: number): number {
  return nowSeconds ?? Math.floor(Date.now() / 1000);
}

/** Fingerprint curto e determinístico da senha (hash) atual. */
export function passwordFingerprint(passwordHash: string): string {
  return createHmac("sha256", secret()).update(passwordHash).digest("base64url").slice(0, 16);
}

export function signResetToken(userId: number, pf: string, nowSeconds?: number): string {
  const body: SignedReset = { userId, pf, exp: nowS(nowSeconds) + TTL_SECONDS };
  const data = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyResetToken(
  token: string,
  nowSeconds?: number,
): { userId: number; pf: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = createHmac("sha256", secret()).update(data).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  let parsed: SignedReset;
  try {
    parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof parsed.exp !== "number" || parsed.exp < nowS(nowSeconds)) return null;
  if (typeof parsed.userId !== "number" || typeof parsed.pf !== "string") return null;
  return { userId: parsed.userId, pf: parsed.pf };
}
