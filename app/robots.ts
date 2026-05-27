import type { MetadataRoute } from "next";
import { PLATFORM_DOMAIN } from "@/lib/platform";

const SITE = PLATFORM_DOMAIN;

/** /robots.txt — libera o rastreio e aponta o sitemap. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Áreas privadas / sem valor de busca.
      disallow: ["/admin", "/superadmin", "/api"],
    },
    sitemap: `https://${SITE}/sitemap.xml`,
  };
}
