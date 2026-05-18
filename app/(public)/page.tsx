import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentTenant, getRequestHost, isPlatformHost } from "@/lib/tenant";
import { MarketplaceLanding } from "@/components/marketing/MarketplaceLanding";
import { Storefront } from "@/components/public/Storefront";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  if (isPlatformHost(await getRequestHost())) {
    return {
      title: "AutoStand — encontre seu próximo carro",
      description:
        "Seminovos de concessionárias multimarca selecionadas, num só lugar. Busque por marca, preço e cidade.",
    };
  }
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();
  if (tenant.status !== "active") return { title: tenant.name };
  return {
    title: `${tenant.name} — Seminovos${tenant.city ? ` em ${tenant.city}` : ""}`,
    description:
      "Compre seu próximo carro com segurança. Seminovos selecionados com procedência.",
  };
}

/**
 * Raiz `/` — ramifica por host:
 *  - host da plataforma  → landing institucional da AutoStand;
 *  - host de tenant      → vitrine da concessionária.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const host = await getRequestHost();
  const sp = await searchParams;

  if (isPlatformHost(host)) {
    return <MarketplaceLanding />;
  }

  return <Storefront sp={sp} />;
}
