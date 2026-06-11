import "server-only";

/**
 * Verificação server-side do Cloudflare Turnstile (CAPTCHA invisível).
 * Quando TURNSTILE_SECRET_KEY não está configurada, a verificação vira
 * no-op (retorna true) — facilita dev e evita quebrar deploys que ainda
 * não wirearam o widget. Em prod o operador configura:
 *
 *   - TURNSTILE_SECRET_KEY       (server, este arquivo)
 *   - NEXT_PUBLIC_TURNSTILE_SITE_KEY (client, components/Turnstile.tsx)
 *
 * Sem essas duas, o widget não renderiza e o servidor não exige token.
 */

const SECRET = process.env.TURNSTILE_SECRET_KEY?.trim();
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
}

/**
 * Verifica o token devolvido pelo widget. Retorna `true` quando:
 *  - Turnstile está desabilitado (no-op)
 *  - O token é válido segundo a Cloudflare
 *
 * Retorna `false` quando:
 *  - Turnstile está habilitado MAS o token está ausente/inválido
 *  - O endpoint da Cloudflare falhou (fail-closed pra não vazar segurança)
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string,
): Promise<boolean> {
  if (!SECRET) return true;
  if (!token) return false;

  const params = new URLSearchParams({ secret: SECRET, response: token });
  if (remoteIp && remoteIp !== "unknown") params.set("remoteip", remoteIp);

  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body: params });
    if (!res.ok) return false;
    const data = (await res.json()) as TurnstileResponse;
    return data.success === true;
  } catch {
    return false;
  }
}
