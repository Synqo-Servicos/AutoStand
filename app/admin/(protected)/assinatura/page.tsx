import { Check, Lock } from "lucide-react";
import { getAdminTenant } from "@/lib/tenant";
import { getPlan } from "@/lib/plans";
import type { PlanCapabilities } from "@/lib/plans";

export const dynamic = "force-dynamic";

const CAP_LABELS: Record<keyof PlanCapabilities, string> = {
  customColors: "Cores da marca personalizáveis",
  layoutConfig: "Customização de layout — hero e estilos de card",
  customDomain: "Domínio próprio",
  instagramPost: "Gerador de post para Instagram",
  aiAnalysis: "Análises de IA da vitrine",
  marketInsights: "Inteligência de demanda",
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export default async function AssinaturaPage() {
  const tenant = await getAdminTenant();
  const plan = getPlan(tenant.plan);
  const active = tenant.status === "active";

  const caps = Object.entries(plan.capabilities) as [keyof PlanCapabilities, boolean][];
  const incluso = caps.filter(([, on]) => on).map(([k]) => k);
  const falta = caps.filter(([, on]) => !on).map(([k]) => k);

  return (
    <div className="max-w-2xl p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="font-display text-h2 font-semibold text-ink">Assinatura</h1>
        <p className="mt-1 text-body-s text-n600">Seu plano e o status da loja.</p>
      </header>

      {/* Status */}
      <section className="rounded-xl border border-n200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-eyebrow font-semibold uppercase text-n600">Plano atual</p>
            <p className="mt-1 font-display text-h3 font-semibold text-ink">{plan.name}</p>
            <p className="text-body-s text-n600">{formatBRL(plan.priceMonthly)}/mês</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-body-s font-medium ring-1 ${
              active
                ? "bg-success/15 text-ink ring-success/40"
                : "bg-warning/15 text-ink ring-warning/40"
            }`}
          >
            {active ? "No ar" : "Pendente"}
          </span>
        </div>
        {!active && (
          <p className="mt-4 rounded-lg bg-warning/15 px-3 py-2 text-body-s text-ink">
            Sua loja ainda não está no ar. A ativação acontece com a confirmação do
            primeiro pagamento — em breve você recebe as instruções.
          </p>
        )}
      </section>

      {/* Recursos */}
      <section className="mt-5 rounded-xl border border-n200 bg-white p-5">
        <h2 className="font-display text-h3 font-semibold text-ink">Seu plano inclui</h2>
        <ul className="mt-3 space-y-2">
          {incluso.map((k) => (
            <li key={k} className="flex items-center gap-2 text-body-s text-ink">
              <Check className="h-4 w-4 shrink-0 text-success" />
              {CAP_LABELS[k]}
            </li>
          ))}
        </ul>

        {falta.length > 0 && (
          <>
            <h3 className="mt-5 text-body-s font-semibold text-n600">
              Disponível em planos superiores
            </h3>
            <ul className="mt-2 space-y-2">
              {falta.map((k) => (
                <li key={k} className="flex items-center gap-2 text-body-s text-n600">
                  <Lock className="h-4 w-4 shrink-0 text-n400" />
                  {CAP_LABELS[k]}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Pagamento */}
      <section className="mt-5 rounded-xl border border-n200 bg-white p-5">
        <h2 className="font-display text-h3 font-semibold text-ink">Pagamento</h2>
        {tenant.mp_subscription_id ? (
          <>
            <p className="mt-1 text-body-s text-n600">
              Gerencie seu cartão e histórico de cobranças diretamente no Mercado Pago.
            </p>
            <a
              href="/api/assinatura"
              className="mt-3 inline-block rounded-lg bg-ink px-4 py-2 text-body-s font-semibold text-white hover:bg-n800"
            >
              Gerenciar pagamento
            </a>
          </>
        ) : (
          <>
            <p className="mt-1 text-body-s text-n600">
              A gestão de pagamento e a troca de plano estarão disponíveis após a ativação
              da assinatura.
            </p>
            <button
              type="button"
              disabled
              className="mt-3 cursor-not-allowed rounded-lg bg-n100 px-4 py-2 text-body-s font-semibold text-n400"
            >
              Gerenciar pagamento
            </button>
          </>
        )}
      </section>
    </div>
  );
}
