import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Store, MapPin } from "lucide-react";
import { requirePlatformHost } from "@/lib/tenant";
import { listMarketplaceTenants } from "@/lib/marketplace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Concessionárias — AutoStand",
  description: "As concessionárias multimarca da rede AutoStand.",
};

export default async function LojasPage() {
  await requirePlatformHost();
  const lojas = await listMarketplaceTenants();

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-ink">Concessionárias</h1>
        <p className="mt-1 text-sm text-n600">
          {lojas.length} {lojas.length === 1 ? "loja parceira" : "lojas parceiras"} na rede AutoStand.
        </p>
      </header>

      {lojas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-n300 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-ink">Nenhuma loja no marketplace ainda</p>
          <p className="mt-1 text-sm text-n500">Volte em breve.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lojas.map((loja) => (
            <Link
              key={loja.slug}
              href={`/loja/${loja.slug}`}
              className="group flex items-center gap-4 rounded-2xl border border-n200 bg-white p-5 transition-shadow hover:shadow-lg"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink/5">
                {loja.logo_url ? (
                  <Image src={loja.logo_url} alt={loja.name} width={56} height={56} className="h-full w-full object-contain" />
                ) : (
                  <Store className="h-6 w-6 text-ink" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-ink transition-colors group-hover:text-signal">
                  {loja.name}
                </span>
                {loja.city && (
                  <span className="flex items-center gap-1 text-xs text-n500">
                    <MapPin className="h-3 w-3" />
                    {loja.city}
                  </span>
                )}
                <span className="mt-0.5 block text-xs text-n500">
                  {loja.vehicleCount} {loja.vehicleCount === 1 ? "veículo" : "veículos"}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
