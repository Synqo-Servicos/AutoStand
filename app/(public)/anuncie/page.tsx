import type { Metadata } from "next";
import { requirePlatformHost } from "@/lib/tenant";
import { PlatformLanding } from "@/components/marketing/PlatformLanding";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Anuncie sua loja — AutoStand",
  description:
    "Site próprio, painel de gestão e o seu estoque no marketplace AutoStand. Mensalidade fixa, sem comissão por venda.",
};

/**
 * Porta do lojista — o pitch B2B. A home (`/`) é voltada ao comprador;
 * a concessionária que quer anunciar chega aqui.
 */
export default async function AnunciePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requirePlatformHost();
  const sp = await searchParams;
  const partnerCode = typeof sp.parceiro === "string" ? sp.parceiro.trim() : "";

  return <PlatformLanding partnerCode={partnerCode || undefined} />;
}
