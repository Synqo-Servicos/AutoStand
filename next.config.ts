import type { NextConfig } from "next";

// Fonte canônica em lib/platform.ts. Aqui replicamos o fallback porque
// next.config.ts roda antes do path alias `@/` estar disponível e não
// pode importar do app code.
const PLATFORM_DOMAIN = (process.env.PLATFORM_DOMAIN ?? "autostand.com.br").trim();

const config: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.autostand.com.br",
      },
      {
        // Homolog serve as imagens de cdn.homologation.autostand.com.br.
        // next/image só carrega hosts allowlistados — sem este, toda
        // imagem via next/image quebra em homolog.
        protocol: "https",
        hostname: "cdn.homologation.autostand.com.br",
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
