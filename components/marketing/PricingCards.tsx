import Link from "next/link";
import { PLAN_SLUGS, PLANS, type PlanSlug } from "@/lib/plans";

/** Texto de venda de cada plano (a fonte da verdade das capabilities é lib/plans.ts). */
const PLAN_COPY: Record<PlanSlug, { tagline: string; features: string[] }> = {
  basico: {
    tagline: "Para tirar a loja do caderno e da planilha.",
    features: [
      "Site próprio com seu estoque",
      "Painel de gestão: estoque, CRM de leads e financeiro",
      "Cores da marca personalizáveis",
      "Subdomínio em autostand.com.br",
    ],
  },
  pro: {
    tagline: "Para a loja que quer cara própria na internet.",
    features: [
      "Tudo do Básico",
      "Domínio próprio (sualoja.com.br)",
      "Customização do layout do site",
      "Variações de vitrine e destaque",
    ],
  },
  premium: {
    tagline: "Para quem quer o sistema decidindo junto.",
    features: [
      "Tudo do Pro",
      "Análises de IA sobre a sua vitrine",
      "Recomendações de melhoria contínuas",
    ],
  },
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function assinarHref(plan: PlanSlug, partnerCode?: string): string {
  const params = new URLSearchParams({ plano: plan });
  if (partnerCode) params.set("parceiro", partnerCode);
  return `/assinar?${params.toString()}`;
}

export function PricingCards({ partnerCode }: { partnerCode?: string }) {
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      {PLAN_SLUGS.map((slug) => {
        const plan = PLANS[slug];
        const copy = PLAN_COPY[slug];
        const highlight = slug === "pro";

        return (
          <div
            key={slug}
            className={`flex flex-col rounded-2xl border p-6 ${
              highlight
                ? "border-signal bg-ink text-white shadow-lg"
                : "border-n200 bg-white text-ink"
            }`}
          >
            {highlight && (
              <span className="mb-3 inline-block self-start rounded-full bg-signal px-2.5 py-0.5 text-eyebrow font-semibold uppercase text-ink">
                Mais escolhido
              </span>
            )}
            <h3 className="font-display text-h3 font-semibold">{plan.name}</h3>
            <p className={`mt-1 text-body-s ${highlight ? "text-n400" : "text-n600"}`}>
              {copy.tagline}
            </p>

            <div className="mt-5 flex items-baseline gap-1">
              <span className="font-display text-h1 font-bold">{formatBRL(plan.priceMonthly)}</span>
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
