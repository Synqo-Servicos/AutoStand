import { auth } from "@/lib/auth";
import { getRecorrencia, listPendingNfse, sumCaixa, sumGrossBetween } from "@/lib/db";
import { normalizeCompetencia } from "@/lib/competencia";
import {
  mesBoundsInclusivos,
  mesesEmOperacao,
  montarImposto,
  planoRbt12,
  type BaseRbt12,
} from "@/lib/finance-config";
import { CaixaCard } from "@/components/superadmin/CaixaCard";
import { RecorrenciaCard } from "@/components/superadmin/RecorrenciaCard";
import { FilaFiscal } from "@/components/superadmin/FilaFiscal";
import { ImpostoCard } from "@/components/superadmin/ImpostoCard";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ competencia?: string }>;

/** "Hoje" pela hora de São Paulo, nunca `toISOString()` (UTC vira o dia errado à noite). */
function competenciaAtual(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
    .format(new Date())
    .slice(0, 7);
}

/**
 * Receita bruta de cada mês que alimenta a RBT12 desta competência.
 *
 * Devolve `null` para competência anterior à abertura da empresa (o picker do
 * topo aceita qualquer mês): sem isso, `mesesEmOperacao <= 0` chegaria em
 * `rbt12`, que estoura `RangeError` — e um `RangeError` aqui derruba a página
 * inteira, com flag ligada ou desligada.
 *
 * As consultas usam `mesBoundsInclusivos`, NÃO `periodBounds`: `sumGrossBetween`
 * compara com `lte` no limite de cima, então o `to` semiaberto de `periodBounds`
 * faria o pagamento da virada do mês entrar em dois meses do array e ser somado
 * duas vezes na mesma RBT12. Ver a docstring de `mesBoundsInclusivos`.
 */
async function consultarBaseRbt12(competencia: string): Promise<BaseRbt12 | null> {
  const meses = mesesEmOperacao(competencia);
  if (meses < 1) return null;

  const plano = planoRbt12(competencia, meses);
  const brutoPorMes = await Promise.all(
    plano.competencias.map((c) => {
      const { from, to } = mesBoundsInclusivos(c);
      return sumGrossBetween(from, to);
    }),
  );
  return { meses, plano, brutoPorMes };
}

export default async function FinanceiroPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  // Valor de fora do formato (ausente, lixo, mês fora de 01–12) cai na
  // competência atual — nunca em 500, nunca num período calculado errado
  // em silêncio. Ver lib/competencia.ts.
  const competencia = normalizeCompetencia(sp.competencia, competenciaAtual());

  // O acesso já foi gateado pelo layout de `(financeiro)`; aqui o papel serve
  // só para decidir se o valor do imposto aparece. Sessão ilegível cai em
  // `undefined`, que segue a flag — o lado conservador.
  const session = await auth().catch(() => null);
  const role = session?.user?.role;

  const [caixa, recorrencia, pendentesNfse, baseRbt12] = await Promise.all([
    sumCaixa(competencia),
    getRecorrencia(),
    // Fila fiscal não é filtrada pela competência do topo: é "o que falta
    // emitir" agora, não um recorte de mês — nasce zerada e cresce a cada
    // pagamento aprovado, independente de qual competência está selecionada.
    listPendingNfse(),
    consultarBaseRbt12(competencia),
  ]);

  // A regra de visibilidade e a montagem do array da RBT12 ficam em
  // lib/finance-config.ts — testáveis sem banco e sem navegador.
  const imposto = montarImposto({
    competencia,
    receitaMesCents: caixa.gross,
    role,
    base: baseRbt12,
  });

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

      <div className="mt-4">
        <ImpostoCard {...imposto} />
      </div>

      <div className="mt-4">
        <FilaFiscal payments={pendentesNfse} />
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
