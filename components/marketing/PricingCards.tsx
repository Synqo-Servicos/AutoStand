import Link from "next/link";
import { PLAN_SLUGS, PLANS, type PlanSlug } from "@/lib/plans";
import { formatBRLFull } from "@/lib/money";

/** Texto de venda de cada plano (a fonte da verdade das capabilities é lib/plans.ts). */
const PLAN_COPY: Record<PlanSlug, { tagline: string; features: string[] }> = {
  pro: {
    tagline: "A loja inteira online, no seu próprio domínio.",
    features: [
      "Site próprio com seu estoque",
      "Domínio próprio (sualoja.com.br)",
      "Painel de gestão: estoque, CRM de leads e financeiro",
      "Layout e cores da sua marca",
      "Gerador de post para Instagram",
    ],
  },
  premium: {
    tagline: "Para quem quer o sistema decidindo junto.",
    features: [
      "Tudo do Pro",
      "Inteligência de demanda: o que o mercado procura",
      "Análises de IA sobre a sua vitrine",
      "Recomendações de melhoria contínuas",
    ],
  },
};

function assinarHref(plan: PlanSlug, partnerCode?: string): string {
  const params = new URLSearchParams({ plano: plan });
  if (partnerCode) params.set("parceiro", partnerCode);
  return `/assinar?${params.toString()}`;
}

export function PricingCards({ partnerCode }: { partnerCode?: string }) {
  return (
    <div className="mx-auto grid max-w-3xl gap-5 sm:grid-cols-2">
      {PLAN_SLUGS.map((slug) => {
        const plan = PLANS[slug];
        const copy = PLAN_COPY[slug];
        // Destaque no Premium — e o selo diz o que ele TEM, não quantos
        // escolheram: sem base instalada, "mais escolhido" seria invenção.
        const highlight = slug === "premium";

        return (
          <div
            key={slug}
            className={`flex flex-col rounded-2xl border p-6 ${
              highlight
                ? "border-signal bg-ink text-white shadow-lg"
                : "border-n200 bg-white text-ink"
            }`}
          >
            {/* Sempre renderizado: com dois cards lado a lado, esconder o selo
                no card sem destaque desalinharia título e preço entre eles. */}
            <span
              aria-hidden={!highlight}
              className={`mb-3 inline-block self-start rounded-full px-2.5 py-0.5 text-eyebrow font-semibold uppercase ${
                highlight ? "bg-signal text-ink" : "invisible"
              }`}
            >
              {highlight ? "Inteligência de demanda" : "\u00A0"}
            </span>
            <h3 className="font-display text-h3 font-semibold">{plan.name}</h3>
            <p className={`mt-1 text-body-s ${highlight ? "text-n400" : "text-n600"}`}>
              {copy.tagline}
            </p>

            <div className="mt-5 flex items-baseline gap-1">
              <span className="font-display text-h1 font-bold">{formatBRLFull(plan.priceMonthly)}</span>
              <span className={`text-body-s ${highlight ? "text-n400" : "text-n600"}`}>/mês</span>
            </div>

            <ul className="mt-5 flex-1 space-y-2.5">
              {copy.features.map((feature) => (
                <li key={feature} className="flex gap-2 text-body-s">
                  <span className="text-signal" aria-hidden="true">
                    ✓
                  </span>
                  <span className={highlight ? "text-n200" : "text-n600"}>{feature}</span>
                </li>
              ))}
            </ul>

            <Link
              href={assinarHref(slug, partnerCode)}
              className={`mt-6 rounded-lg px-4 py-2.5 text-center text-body-s font-semibold transition-colors ${
                highlight
                  ? "bg-signal text-ink hover:bg-signal-dark"
                  : "bg-ink text-white hover:bg-ink-800"
              }`}
            >
              Assinar o {plan.name}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
