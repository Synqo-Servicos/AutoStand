import { getRecorrencia, sumCaixa } from "@/lib/db";
import { normalizeCompetencia } from "@/lib/competencia";
import { CaixaCard } from "@/components/superadmin/CaixaCard";
import { RecorrenciaCard } from "@/components/superadmin/RecorrenciaCard";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ competencia?: string }>;

/** "Hoje" pela hora de São Paulo, nunca `toISOString()` (UTC vira o dia errado à noite). */
function competenciaAtual(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
    .format(new Date())
    .slice(0, 7);
}

export default async function FinanceiroPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  // Valor de fora do formato (ausente, lixo, mês fora de 01–12) cai na
  // competência atual — nunca em 500, nunca num período calculado errado
  // em silêncio. Ver lib/competencia.ts.
  const competencia = normalizeCompetencia(sp.competencia, competenciaAtual());

  const [caixa, recorrencia] = await Promise.all([
    sumCaixa(competencia),
    getRecorrencia(),
  ]);

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <h1 className="font-display text-h1 font-semibold text-ink">Financeiro</h1>
          <p className="text-sm text-n600 mt-1">Receita da plataforma</p>
        </div>
        <CompetenciaPicker competencia={competencia} />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CaixaCard competencia={competencia} caixa={caixa} />
        <RecorrenciaCard recorrencia={recorrencia} />
      </div>
    </div>
  );
}

function CompetenciaPicker({ competencia }: { competencia: string }) {
  return (
    <form className="flex items-center gap-2" action="/superadmin/financeiro" method="get">
      <label className="text-xs text-n600" htmlFor="competencia">Competência</label>
      <input
        id="competencia"
        type="month"
        name="competencia"
        defaultValue={competencia}
        className="border border-n200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-signal focus:border-transparent"
      />
      <button
        type="submit"
        className="px-3 py-1.5 text-xs font-medium bg-ink text-white rounded-lg hover:bg-ink/90 transition-colors cursor-pointer"
      >
        Aplicar
      </button>
    </form>
  );
}
