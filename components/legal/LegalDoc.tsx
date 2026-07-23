import type { ReactNode } from "react";

/** Wrapper de leitura para documentos legais (Termos, Privacidade).
 *  Largura de leitura confortável (~68ch) e hierarquia via tokens do design system. */
export function LegalDoc({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-[68ch] px-5 py-12">
      <h1 className="font-display text-h1 text-ink">{title}</h1>
      <p className="mt-2 text-body-s text-n500">Última atualização: {updatedAt}</p>
      <div className="mt-8 space-y-8 text-body text-n700 [&_a]:text-signal [&_a]:underline [&_h2]:font-display [&_h2]:text-h3 [&_h2]:font-semibold [&_h2]:text-ink [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
      <div className="mt-12 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-body-s text-n700">
        <strong className="text-ink">Aviso:</strong> minuta preparada para o
        lançamento. Recomenda-se revisão por advogado antes da versão definitiva.
      </div>
    </main>
  );
}
