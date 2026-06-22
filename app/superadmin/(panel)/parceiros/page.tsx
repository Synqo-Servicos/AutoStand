import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { listPartners } from "@/lib/db";
import { formatBRL } from "@/lib/money";

export const dynamic = "force-dynamic";

function formatDesconto(type: string, value: number): string {
  if (type === "amount") {
    return formatBRL(value);
  }
  return `${value}%`;
}

export default async function ParceirosPage() {
  const partners = await listPartners();

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Parceiros</h1>
          <p className="text-sm text-n600 mt-1">{partners.length} cadastrados</p>
        </div>
        <Link
          href="/superadmin/parceiros/novo"
          className="inline-flex items-center gap-2 bg-signal text-ink text-sm font-medium px-4 py-2 rounded-lg hover:bg-signal-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo parceiro
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-n200/70 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-n100 text-sm">
          <thead>
            <tr className="bg-n50">
              {["Parceiro", "Desconto", "Usos", "Validade", "Status", ""].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-n600 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-n100">
            {partners.map((p) => (
              <tr key={p.id} className="hover:bg-n50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{p.name}</p>
                  <p className="text-xs text-n400">?parceiro={p.code}</p>
                </td>
                <td className="px-4 py-3 text-n600 whitespace-nowrap">
                  {formatDesconto(p.discount_type, p.discount_value)}
                </td>
                <td className="px-4 py-3 text-n600 whitespace-nowrap">
                  {p.signup_count}
                  {p.max_uses != null && <span className="text-n400"> / {p.max_uses}</span>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-n600">
                  {p.expires_at ?? <span className="text-n400">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      p.status === "active"
                        ? "bg-success/12 text-ink ring-1 ring-success/30"
                        : "bg-n100 text-n600 ring-1 ring-n200"
                    }`}
                  >
                    {p.status === "active" ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/superadmin/parceiros/${p.id}`}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-n200 text-n700 transition-colors hover:border-n400 hover:bg-n50 hover:text-ink"
                  >
                    <Pencil className="w-3 h-3" />
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {partners.length === 0 && (
          <div className="py-16 text-center text-n400">
            <p className="font-medium">Nenhum parceiro cadastrado</p>
            <Link
              href="/superadmin/parceiros/novo"
              className="mt-3 inline-block text-sm text-signal hover:text-signal-dark"
            >
              Cadastrar o primeiro →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
