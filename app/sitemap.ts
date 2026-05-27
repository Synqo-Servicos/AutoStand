import type { MetadataRoute } from "next";
import {
  searchMarketplaceVehicles,
  listMarketplaceTenants,
  MARKETPLACE_PAGE_SIZE,
} from "@/lib/marketplace";

import { PLATFORM_ORIGIN } from "@/lib/platform";

const SITE = PLATFORM_ORIGIN;

/** Regenera o sitemap a cada hora. */
export const revalidate = 3600;

/** /sitemap.xml — páginas do marketplace + cada veículo e cada loja. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/comprar`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE}/lojas`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE}/anuncie`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  try {
    const first = await searchMarketplaceVehicles({});
    const vehicles = [...first.vehicles];
    const pages = Math.ceil(first.total / MARKETPLACE_PAGE_SIZE);
    for (let p = 2; p <= pages; p++) {
      vehicles.push(...(await searchMarketplaceVehicles({ page: p })).vehicles);
    }
    const lojas = await listMarketplaceTenants();

    return [
      ...staticPages,
      ...vehicles.map((v) => ({
        url: `${SITE}/comprar/${v.id}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...lojas.map((l) => ({
        url: `${SITE}/loja/${l.slug}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    // Banco indisponível na geração — devolve ao menos as páginas fixas.
    return staticPages;
  }
}
