import Link from "next/link";
import { Plus, Tag } from "lucide-react";
import { listCoupons } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { Badge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

function formatDesconto(type: string, value: number | null): string {
  if (type === "free_month") return "1º mês grátis";
  if (type === "fixed") {
    return `${formatBRL(value ?? 0)} off`;
  }
  return `${value ?? 0}% off`;
}

export default async function CuponsPage() {
  const cupons = await listCoupons();

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="font-display text-h1 font-semibold text-ink">Cupons</h1>
          <p className="text-sm text-n600 mt-1">{cupons.length} cadastrados</p>
        </div>
        <Link
          href="/superadmin/cupons/novo"
          className="inline-flex items-center gap-2 bg-signal text-ink text-sm font-medium px-4 py-2 rounded-lg hover:bg-signal-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo cupom
        </Link>
      </div>

      {cupons.length === 0 ? (
        <div className="bg-white rounded-xl border border-n200/70">
          <EmptyState
            icon={Tag}
            title="Nenhum cupom cadastrado"
            cta={
              <Link
                href="/superadmin/cupons/novo"
                className="text-sm font-medium text-signal hover:text-signal-dark"
              >
                Criar o primeiro →
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="hidden md:block bg-white rounded-xl border border-n200/70 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-n100 text-sm">
                <thead>
                  <tr className="bg-n50">
                    {["Código", "Desconto", "Usos", "Validade", "Status"].map((h) => (
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
                  {cupons.map((c) => (
                    <tr key={c.id} className="hover:bg-n50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-signal shrink-0" />
                          <span className="font-mono font-semibold text-ink">{c.code}</span>
                        </div>
                        {c.description && (
                          <p className="text-xs text-n400 mt-0.5 pl-5">{c.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-n600 whitespace-nowrap">
                        {formatDesconto(c.discount_type, c.discount_value)}
                      </td>
                      <td className="px-4 py-3 text-n600 whitespace-nowrap">
                        {c.used_count}
                        <span className="text-n400"> / {c.max_uses}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-n600">
                        {c.expires_at ?? <span className="text-n400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={c.used_count < c.max_uses ? "available" : "neutral"} dot size="sm">
                          {c.used_count < c.max_uses ? "Disponível" : "Esgotado"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile: lista de cards */}
          <ul className="md:hidden space-y-3">
            {cupons.map((c) => (
              <li key={c.id} className="bg-white rounded-xl border border-n200/70 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Tag className="w-3.5 h-3.5 text-signal shrink-0" />
                    <div className="min-w-0">
                      <p className="font-mono font-semibold text-ink truncate">{c.code}</p>
                      {c.description && (
                        <p className="text-xs text-n400 truncate">{c.description}</p>
                      )}
                    </div>
                  </div>
                  <Badge tone={c.used_count < c.max_uses ? "available" : "neutral"} dot size="sm">
                    {c.used_count < c.max_uses ? "Disponível" : "Esgotado"}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-n600">
                  <span>
                    {formatDesconto(c.discount_type, c.discount_value)} · {c.used_count} / {c.max_uses} usos
                  </span>
                  {c.expires_at && <span className="text-n400">até {c.expires_at}</span>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
