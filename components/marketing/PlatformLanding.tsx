import Link from "next/link";
import { PricingCards } from "./PricingCards";

/** Landing institucional da AutoStand. Copy alinhada ao Manual da Marca. */
export function PlatformLanding({ partnerCode }: { partnerCode?: string }) {
  const assinarHref = partnerCode
    ? `/assinar?parceiro=${encodeURIComponent(partnerCode)}`
    : "/assinar";

  return (
    <>
      {/* Hero */}
      <section className="bg-ink px-5 py-24 text-white">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-eyebrow font-semibold uppercase text-signal">
            Gestão para revendas multimarca
          </p>
          <h1 className="mt-4 font-display text-h1 font-bold leading-tight sm:text-[3.25rem]">
            Venda mais. <span className="text-signal">Improvise menos.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-body-l text-n400">
            A AutoStand integra estoque, CRM, financeiro e comissões em uma só
            plataforma. Sem retrabalho, sem planilha solta, sem decisão no escuro.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href={assinarHref}
              className="rounded-lg bg-signal px-6 py-3 font-semibold text-ink transition-colors hover:bg-signal-dark"
            >
              Assinar agora
            </Link>
            <a
              href="#planos"
              className="rounded-lg border border-white/20 px-6 py-3 font-semibold text-white transition-colors hover:border-white/40"
            >
              Ver planos
            </a>
          </div>
        </div>
      </section>

      {/* Posicionamento + pilares */}
      <section id="como-funciona" className="bg-sand px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-2xl">
            <p className="text-eyebrow font-semibold uppercase text-signal">Como funciona</p>
            <h2 className="mt-3 font-display text-h2 font-semibold text-ink">
              Não é só um sistema. É um sócio operacional.
            </h2>
            <p className="mt-4 text-body text-n600">
              Da entrada do veículo à comissão do vendedor, tudo conectado e
              conversando entre si. Você decide com base em fato, não em sensação.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              {
                t: "Controle",
                h: "Cada número no seu lugar.",
                d: "Estoque, vendas, CRM, comissões e financeiro numa só plataforma — a operação inteira em tempo real.",
              },
              {
                t: "Clareza",
                h: "Software que respeita o lojista.",
                d: "Interface limpa, fluxos curtos, linguagem direta. Nada de telas confusas ou jargão corporativo.",
              },
              {
                t: "Parceria",
                h: "Do lado da loja, todo dia.",
                d: "Atendimento consultivo, com gente que entende revenda. Caminhamos junto enquanto a loja cresce.",
              },
            ].map((pilar) => (
              <div key={pilar.t} className="rounded-2xl border border-n200 bg-white p-6">
                <p className="text-eyebrow font-semibold uppercase text-signal">{pilar.t}</p>
                <h3 className="mt-2 font-display text-h3 font-semibold text-ink">{pilar.h}</h3>
                <p className="mt-2 text-body-s text-n600">{pilar.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="bg-n50 px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-eyebrow font-semibold uppercase text-signal">Planos</p>
            <h2 className="mt-3 font-display text-h2 font-semibold text-ink">
              Um plano para cada momento da loja.
            </h2>
            <p className="mt-4 text-body text-n600">
              Mensalidade fixa, sem comissão por venda. Sem fidelidade. O site
              entra no ar com o primeiro pagamento.
            </p>
          </div>
          <div className="mt-10">
            <PricingCards partnerCode={partnerCode} />
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-ink px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-h2 font-semibold text-white">
            Pronto para profissionalizar a gestão?
          </h2>
          <p className="mt-3 text-body text-n400">
            Em poucos minutos sua loja tem site e painel próprios.
          </p>
          <Link
            href={assinarHref}
            className="mt-7 inline-block rounded-lg bg-signal px-6 py-3 font-semibold text-ink transition-colors hover:bg-signal-dark"
          >
            Assinar agora
          </Link>
        </div>
      </section>
    </>
  );
}
