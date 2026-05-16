import { Lock } from "lucide-react";
import { getAdminTenant } from "@/lib/tenant";
import { capabilitiesFor } from "@/lib/plans";
import { aiConfigured } from "@/lib/ai";
import { AnaliseIA } from "@/components/admin/AnaliseIA";

export const dynamic = "force-dynamic";

export default async function AnalisePage() {
  const tenant = await getAdminTenant();
  const canUse = capabilitiesFor(tenant.plan).aiAnalysis;

  return (
    <div className="max-w-3xl p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="font-display text-h2 font-semibold text-ink">Análise de IA</h1>
        <p className="mt-1 text-body-s text-n600">
          Recomendações para a sua vitrine converter mais.
        </p>
      </header>

      {canUse ? (
        <AnaliseIA configured={aiConfigured()} />
      ) : (
        <div className="rounded-xl border border-n200 bg-white p-6">
          <div className="flex items-center gap-2 text-ink">
            <Lock className="h-4 w-4" />
            <h2 className="font-display text-h3 font-semibold">Recurso do plano Premium</h2>
          </div>
          <p className="mt-2 text-body-s text-n600">
            A análise de IA da vitrine está disponível no plano Premium — a IA avalia
            sua marca, layout e catálogo e sugere melhorias concretas.
          </p>
          <a
            href="/admin/assinatura"
            className="mt-4 inline-block text-body-s font-semibold text-ink underline"
          >
            Ver assinatura
          </a>
        </div>
      )}
    </div>
  );
}
