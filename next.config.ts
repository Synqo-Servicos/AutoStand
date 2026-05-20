import type { NextConfig } from "next";

const PLATFORM_DOMAIN = (process.env.PLATFORM_DOMAIN ?? "autostand.com.br").trim();

const config: NextConfig = {
  serverExternalPackages: ["@libsql/client", "libsql"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async redirects() {
    // www.autostand.com.br → autostand.com.br (o wildcard pegaria "www"
    // como slug de loja). Redireciona para o apex, canônico para SEO.
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: `www.${PLATFORM_DOMAIN}` }],
        destination: `https://${PLATFORM_DOMAIN}/:path*`,
        permanent: true,
      },
    ];
  },
};

export default config;
