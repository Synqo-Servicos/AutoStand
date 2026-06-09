import Link from "next/link";
import { Plus, Tag } from "lucide-react";
import { listCoupons } from "@/lib/db";

export const dynamic = "force-dynamic";

function formatDesconto(type: string, value: number | null): string {
  if (type === "free_month") return "1º mês grátis";
  if (type === "fixed") {
    return (
      ((value ?? 0) / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }) + " off"
    );
  }
  return `${value ?? 0}% off`;
}

export default async function CuponsPage() {
  const cupons = await listCoupons();

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Cupons</h1>
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

      <div className="bg-white rounded-xl border border-n200/70 overflow-hidden">
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
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      c.used_count < c.max_uses
                        ? "bg-success/12 text-ink ring-1 ring-success/30"
                        : "bg-n100 text-n600 ring-1 ring-n200"
                    }`}
                  >
                    {c.used_count < c.max_uses ? "Disponível" : "Esgotado"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {cupons.length === 0 && (
          <div className="py-16 text-center text-n400">
            <p className="font-medium">Nenhum cupom cadastrado</p>
            <Link
              href="/superadmin/cupons/novo"
              className="mt-3 inline-block text-sm text-signal hover:text-signal-dark"
            >
              Criar o primeiro →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
