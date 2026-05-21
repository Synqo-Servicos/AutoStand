/**
 * Planos da plataforma (AutoStand) e suas capabilities.
 *
 * Os 3 tiers são diferenciados por funcionalidade — não há limite de veículos
 * (o mercado-alvo é homogêneo demais para a contagem segmentar planos).
 * Preços são ponto de partida, a validar com prospects.
 */

export type PlanSlug = "basico" | "pro" | "premium";

export interface PlanCapabilities {
  /** Editar as cores da marca. Disponível em todos os planos. */
  customColors: boolean;
  /** Configurar layout — hero, estilos de card, seções. */
  layoutConfig: boolean;
  /** Conectar um domínio próprio (além do subdomínio padrão). */
  customDomain: boolean;
  /** Gerar post de Instagram (imagem + legenda) a partir de um veículo. */
  instagramPost: boolean;
  /** Análises de IA sobre a customização do site. */
  aiAnalysis: boolean;
  /** Inteligência de demanda — o que o mercado está procurando. */
  marketInsights: boolean;
}

export interface Plan {
  slug: PlanSlug;
  name: string;
  /** Preço mensal em centavos (BRL). */
  priceMonthly: number;
  /** Price ID do Stripe — definido via env, consumido no Checkout (Fase 2). */
  stripePriceId: string | undefined;
  capabilities: PlanCapabilities;
}

export const PLANS: Record<PlanSlug, Plan> = {
  basico: {
    slug: "basico",
    name: "Básico",
    priceMonthly: 14900,
    stripePriceId: process.env.STRIPE_PRICE_BASICO,
    capabilities: {
      customColors: true,
      layoutConfig: false,
      customDomain: false,
      instagramPost: false,
      aiAnalysis: false,
      marketInsights: false,
    },
  },
  pro: {
    slug: "pro",
    name: "Pro",
    priceMonthly: 34900,
    stripePriceId: process.env.STRIPE_PRICE_PRO,
    capabilities: {
      customColors: true,
      layoutConfig: true,
      customDomain: true,
      instagramPost: true,
      aiAnalysis: false,
      marketInsights: false,
    },
  },
  premium: {
    slug: "premium",
    name: "Premium",
    priceMonthly: 59900,
    stripePriceId: process.env.STRIPE_PRICE_PREMIUM,
    capabilities: {
      customColors: true,
      layoutConfig: true,
      customDomain: true,
      instagramPost: true,
      aiAnalysis: true,
      marketInsights: true,
    },
  },
};

export const PLAN_SLUGS = Object.keys(PLANS) as PlanSlug[];

export function isPlanSlug(value: unknown): value is PlanSlug {
  return typeof value === "string" && value in PLANS;
}

/** Plano por slug. Aceita o valor cru do banco (string | null) e cai no Básico. */
export function getPlan(slug: string | null | undefined): Plan {
  return isPlanSlug(slug) ? PLANS[slug] : PLANS.basico;
}

/** Capabilities do plano. Tenant sem plano definido cai nas capabilities do Básico. */
export function capabilitiesFor(slug: string | null | undefined): PlanCapabilities {
  return getPlan(slug).capabilities;
}
