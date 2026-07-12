import Link from "next/link";
import { FileText } from "lucide-react";
import { TEMPLATES } from "@/lib/document-templates";

export const dynamic = "force-dynamic";

export default function DocumentosPage() {
  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="font-display text-h2 font-semibold text-ink">Documentos & Contratos</h1>
        <p className="text-sm text-n600 mt-1">
          Templates prontos para gerar contratos, recibos e termos preenchidos
          automaticamente com os dados do veículo.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TEMPLATES.map((tpl) => (
          <Link
            key={tpl.id}
            href={`/admin/documentos/${tpl.id}`}
            className="group bg-white border border-n100 rounded-xl p-5 hover:border-signal hover:shadow-sm transition"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-md bg-signal/10 flex items-center justify-center text-signal shrink-0 group-hover:bg-signal group-hover:text-white transition-colors">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-body-s font-semibold text-ink leading-snug">{tpl.name}</h2>
                <p className="text-xs text-n500 mt-1 line-clamp-3">{tpl.description}</p>
                {!tpl.requiresVehicle && (
                  <p className="mt-2 inline-flex text-[10px] font-semibold uppercase tracking-wider text-n500 bg-n50 px-2 py-0.5 rounded">
                    Sem veículo do estoque
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
