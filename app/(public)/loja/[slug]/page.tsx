import { notFound, permanentRedirect } from "next/navigation";
import { requirePlatformHost } from "@/lib/tenant";
import {
  getMarketplaceTenantBySlug,
  tenantSiteUrl,
} from "@/lib/marketplace";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

/**
 * URL canônica de uma loja é o subdomínio (ou custom_domain).
 * Esta rota existe só para preservar links antigos e redirecionar 308.
 */
export default async function LojaPage({ params }: Params) {
  await requirePlatformHost();
  const { slug } = await params;
  const loja = await getMarketplaceTenantBySlug(slug);
  if (!loja) notFound();
  permanentRedirect(tenantSiteUrl(loja));
}
