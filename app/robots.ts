import type { MetadataRoute } from "next";

const SITE = (process.env.PLATFORM_DOMAIN ?? "autostand.com.br").trim();

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
