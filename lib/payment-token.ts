import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_SECONDS = 30 * 60; // 30 minutos

export interface PaymentTokenPayload {
  tenantId: number;
  planSlug: string;
  couponId: number | null;
}

interface SignedPayload extends PaymentTokenPayload {
  exp: number; // unix seconds
}

function secret(): string {
  const s = process.env.PAYMENT_TOKEN_SECRET;
  if (!s) throw new Error("PAYMENT_TOKEN_SECRET não configurado.");
  return s;
}

function nowS(nowSeconds?: number): number {
  return nowSeconds ?? Math.floor(Date.now() / 1000);
}

export function signPaymentToken(payload: PaymentTokenPayload, nowSeconds?: number): string {
  const body: SignedPayload = { ...payload, exp: nowS(nowSeconds) + TTL_SECONDS };
  const data = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyPaymentToken(token: string, nowSeconds?: number): PaymentTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = createHmac("sha256", secret()).update(data).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  let parsed: SignedPayload;
  try {
    parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof parsed.exp !== "number" || parsed.exp < nowS(nowSeconds)) return null;
  return { tenantId: parsed.tenantId, planSlug: parsed.planSlug, couponId: parsed.couponId ?? null };
}
