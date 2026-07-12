import { Lock } from "lucide-react";
import { getAdminTenant } from "@/lib/tenant";
import { capabilitiesFor } from "@/lib/plans";
import { aiConfigured } from "@/lib/ai";
import { getDemandSnapshot } from "@/lib/demand";
import { DemandPanel } from "@/components/admin/DemandPanel";
import { InteligenciaDicas } from "@/components/admin/InteligenciaDicas";

export const dynamic = "force-dynamic";

export default async function InteligenciaPage() {
  const tenant = await getAdminTenant();
  const canUse = capabilitiesFor(tenant.plan).marketInsights;

  if (!canUse) {
    return (
      <div className="p-4 sm:p-8 max-w-3xl">
        <h1 className="font-display text-h2 font-semibold text-ink">Inteligência de demanda</h1>
        <div className="mt-6 rounded-xl border border-n200 bg-white p-6">
          <div className="flex items-center gap-2 text-ink">
            <Lock className="h-4 w-4" />
            <h2 className="font-display text-h3 font-semibold text-ink">Recurso do plano Premium</h2>
          </div>
          <p className="mt-2 text-sm text-n600">
            A inteligência de demanda mostra o que os compradores estão procurando —
            marcas, faixas de preço e carrocerias mais buscadas no seu site e no
            marketplace AutoStand — com dicas de estoque geradas por IA.
          </p>
          <a
            href="/admin/assinatura"
            className="mt-4 inline-block text-sm font-semibold text-ink underline"
          >
            Ver assinatura
          </a>
        </div>
      </div>
    );
  }

  const [marketplace, loja] = await Promise.all([
    getDemandSnapshot("marketplace"),
    getDemandSnapshot({ tenantId: tenant.id }),
  ]);

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <header className="mb-6">
        <h1 className="font-display text-h2 font-semibold text-ink">Inteligência de demanda</h1>
        <p className="text-sm text-n600 mt-1">
          O que os compradores estão procurando nos últimos {marketplace.windowDays}{" "}
          dias — dados anônimos, sem informação pessoal.
        </p>
      </header>

      <InteligenciaDicas configured={aiConfigured()} />

      <div className="mt-8 space-y-8">
        <DemandPanel
          title="Demanda no marketplace AutoStand"
          subtitle="O mercado todo — buscas das concessionárias da rede. Só a plataforma vê esse agregado."
          snapshot={marketplace}
        />
        <DemandPanel
          title="Demanda no seu site"
          subtitle="Buscas e visualizações no site da sua loja."
          snapshot={loja}
        />
      </div>
    </div>
  );
}
