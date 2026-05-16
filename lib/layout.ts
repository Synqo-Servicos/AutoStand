/**
 * Configuração de layout do site público de um tenant.
 *
 * Persistida em `tenants.layout_config` (coluna JSON). O Milestone 2 / Fase 4
 * expande este contrato e passa a consumi-lo na renderização do site público.
 * Por enquanto serve apenas como o tipo da coluna e o conjunto de padrões.
 */
export interface LayoutConfig {
  /** Estilo do hero da homepage. */
  heroStyle: "gradient" | "solid" | "image";
  /** URL da imagem do hero — usada quando `heroStyle === "image"`. */
  heroImageUrl: string | null;
  /** Estilo visual dos cards de veículo na vitrine. */
  cardStyle: "elevated" | "bordered" | "minimal" | "compact" | "overlay";
  /** Quantidade de cards por fila na vitrine (desktop). */
  cardsPerRow: 3 | 4;
}

/** Layout aplicado a tenants que ainda não customizaram (ou no plano Básico). */
export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  heroStyle: "gradient",
  heroImageUrl: null,
  cardStyle: "elevated",
  cardsPerRow: 3,
};

/** Resolve a config efetiva — preenche com os padrões o que o tenant não definiu. */
export function resolveLayoutConfig(config: LayoutConfig | null | undefined): LayoutConfig {
  return { ...DEFAULT_LAYOUT_CONFIG, ...(config ?? {}) };
}

/** Variantes disponíveis — usadas pelos seletores da UI de personalização. */
export const HERO_STYLES: readonly LayoutConfig["heroStyle"][] = ["gradient", "solid", "image"];
export const CARD_STYLES: readonly LayoutConfig["cardStyle"][] = [
  "elevated",
  "bordered",
  "minimal",
  "compact",
  "overlay",
];

/**
 * Valida/saneia uma config crua (ex.: payload do cliente) — campo a campo,
 * caindo no padrão quando o valor é inválido. Nunca confie no cliente.
 */
export function sanitizeLayoutConfig(raw: unknown): LayoutConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    heroStyle: HERO_STYLES.includes(r.heroStyle as LayoutConfig["heroStyle"])
      ? (r.heroStyle as LayoutConfig["heroStyle"])
      : DEFAULT_LAYOUT_CONFIG.heroStyle,
    heroImageUrl:
      typeof r.heroImageUrl === "string" && r.heroImageUrl.trim()
        ? r.heroImageUrl.trim()
        : null,
    cardStyle: CARD_STYLES.includes(r.cardStyle as LayoutConfig["cardStyle"])
      ? (r.cardStyle as LayoutConfig["cardStyle"])
      : DEFAULT_LAYOUT_CONFIG.cardStyle,
    cardsPerRow: r.cardsPerRow === 4 ? 4 : 3,
  };
}
