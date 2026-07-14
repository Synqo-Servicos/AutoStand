import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limit por IP em endpoints públicos. Usa Upstash Redis (sliding
 * window). Quando UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN não
 * estão configurados, todos os limiters viram no-op — ideal pra dev e
 * pra deploys que ainda não plugaram o Redis. Em prod o operador
 * configura as duas envs nos secrets do GitHub Environment.
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
  /** Login (Credentials). Anti-brute-force: 10 tentativas / 10 min por IP+email. */
  login: makeLimiter(10, "10 m", "rl:login"),
  /** Tentativas de pagamento no checkout transparente. 8/min por IP. */
  checkoutPayment: makeLimiter(8, "1 m", "rl:checkout"),
  /** Pedido de reset de senha. 5/hora por IP — barra e-mail bombing. */
  passwordReset: makeLimiter(5, "1 h", "rl:pwreset"),
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

/** Extrai o IP do cliente a partir dos headers do request.
 *
 *  Infraestrutura: Vercel. O edge da Vercel termina a conexão do cliente e
 *  seta `x-real-ip` com o IP do socket — o cliente não consegue forjá-lo,
 *  porque a plataforma sobrescreve o header. Essa é a fonte confiável.
 *
 *  `x-forwarded-for` é só fallback: a Vercel *anexa* o IP real ao que o
 *  cliente mandou, então a cadeia é `[o-que-o-cliente-mandou..., real]` e
 *  qualquer posição no meio é controlada pelo atacante. Usamos a PRIMEIRA
 *  entrada (convenção XFF: o cliente original) e nunca a penúltima — a
 *  heurística antiga, herdada da cadeia CloudFront → ALB → ECS, devolvia
 *  um valor arbitrário do atacante e permitia furar o rate limit. */
export function getClientIp(req: { headers: Headers }): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const [first] = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (first) return first;
  }
  return "unknown";
}
