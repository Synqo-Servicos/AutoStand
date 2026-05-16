import type { Metadata } from "next";
import { getRequestHost, isPlatformHost, requireTenant } from "@/lib/tenant";
import { PlatformLanding } from "@/components/marketing/PlatformLanding";
import { Storefront } from "@/components/public/Storefront";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  if (isPlatformHost(await getRequestHost())) {
    return {
      title: "AutoStand — o sistema operacional da revenda multimarca",
      description:
        "Site, estoque, CRM e financeiro para concessionárias multimarca. Mensalidade fixa, sem comissão por venda.",
    };
  }
  const tenant = await requireTenant();
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
    const partnerCode = typeof sp.parceiro === "string" ? sp.parceiro.trim() : "";
    return <PlatformLanding partnerCode={partnerCode || undefined} />;
  }

  return <Storefront sp={sp} />;
}
