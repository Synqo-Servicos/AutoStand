/**
 * Constantes da plataforma — fonte única para o domínio raiz e
 * URLs derivadas. Não duplicar `process.env.PLATFORM_DOMAIN ??
 * "autostand.com.br"` em outros arquivos; importe daqui.
 */

const RAW = (process.env.PLATFORM_DOMAIN ?? "autostand.com.br").trim();

/** Domínio raiz da plataforma (ex.: `autostand.com.br`), sem protocolo. */
export const PLATFORM_DOMAIN = RAW;

/** Mesmo valor em lowercase — útil para comparação de Host header. */
export const PLATFORM_DOMAIN_LC = RAW.toLowerCase();

/** Origin canônico HTTPS (ex.: `https://autostand.com.br`). */
export const PLATFORM_ORIGIN = `https://${RAW}`;

/** Subdomínio do console super-admin (ex.: `console.autostand.com.br`). */
export const CONSOLE_HOST = `console.${RAW}`;

/** Constrói o subdomínio público de um tenant. */
export function tenantSubdomain(slug: string): string {
  return `${slug}.${RAW}`;
}

/** Path da rota que recebe os webhooks do MP (`app/api/webhooks/mercadopago/route.ts`). */
const MP_WEBHOOK_PATH = "/api/webhooks/mercadopago";

/**
 * URL de notificação (webhook) do Mercado Pago. É enviada EXPLICITAMENTE em
 * todo payload de criação de plano/assinatura (ver `lib/checkout.ts`).
 *
 * Por que no código e não só no painel do MP: lá ela era um ponto cego — não
 * versionada, não verificável por CI. Numa migração de infra (AWS → Vercel)
 * ela pode continuar apontando pro host morto sem ninguém perceber: o MP
 * retenta, desiste, o webhook nunca chega e o tenant fica `suspended` para
 * sempre, em silêncio. Passando no payload, o valor acompanha o deploy.
 *
 * Sempre o APEX da plataforma (`PLATFORM_ORIGIN`), NUNCA o subdomínio ou o
 * `custom_domain` do tenant: o webhook é server-to-server, e só o apex tem a
 * rota e o `MERCADOPAGO_WEBHOOK_SECRET` que valida a assinatura. Não confundir
 * com o `back_url`, que é redirect do usuário e vai pro host da loja.
 */
export function mpNotificationUrl(): string {
  return `${PLATFORM_ORIGIN}${MP_WEBHOOK_PATH}`;
}
