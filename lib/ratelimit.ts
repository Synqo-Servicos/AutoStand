import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

/**
 * Rate limit por IP em endpoints públicos. Usa Upstash Redis (sliding
 * window). Quando UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN não
 * estão configurados, todos os limiters viram no-op — ideal pra dev e
 * pra deploys que ainda não plugaram o Redis. Em prod o operador
 * configura as duas envs via `vercel env add`.
 *
 * Limiters são propositalmente conservadores: signup é um evento raro
 * (poucos por hora), lead é um pouco mais frequente mas ainda baixo.
 */

const HAS_UPSTASH = Boolean(
  process.env.UPSTASH_REDIS_REST_URL?.trim() &&
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
);

const redis = HAS_UPSTASH ? Redis.fromEnv() : null;

function makeLimiter(
  rate: number,
  window: `${number} ${"s" | "m" | "h" | "d"}`,
  prefix: string,
): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(rate, window),
    prefix,
    analytics: true,
  });
}

/**
 * Cada limiter é uma chave do allowlist — handlers referenciam pelo nome,
 * o que mantém a configuração centralizada e auditável.
 */
export const limiters = {
  /** Cadastro self-service de loja. Raro, 5/hora por IP é folgado. */
  signup: makeLimiter(5, "1 h", "rl:signup"),
  /** Lead do marketplace. 5/min por IP cobre testes legítimos e barra spam. */
  lead: makeLimiter(5, "1 m", "rl:lead"),
  /** Validação pública de cupom. Limite conservador para evitar enumeração. */
  couponValidate: makeLimiter(10, "1 m", "rl:coupon"),
} as const;

export type LimiterName = keyof typeof limiters;

export interface RateLimitResult {
  ok: boolean;
  /** Segundos até o limite resetar; presente quando ok=false. */
  retryAfter?: number;
}

/** Best-effort: falhas de Redis viram "ok" — não vamos derrubar formulários
 *  legítimos por causa de outage do Upstash. */
export async function checkRateLimit(
  name: LimiterName,
  key: string,
): Promise<RateLimitResult> {
  const limiter = limiters[name];
  if (!limiter) return { ok: true };
  try {
    const result = await limiter.limit(key);
    if (result.success) return { ok: true };
    const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    return { ok: false, retryAfter };
  } catch {
    return { ok: true };
  }
}

/** Extrai o IP do cliente a partir dos headers do request — Vercel popula
 *  `x-forwarded-for` com o IP real do edge. */
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
