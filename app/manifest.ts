import type { MetadataRoute } from "next";

/**
 * Web App Manifest (PWA). O Next injeta automaticamente o
 * `<link rel="manifest">` quando este arquivo existe.
 *
 * `start_url` aponta para o painel do lojista: instalado a partir de
 * autostand.com.br, o ícone abre direto no dashboard (faz login se preciso).
 * O scope cobre todo o origin (marketplace + admin).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AutoStand — Painel da Loja",
    short_name: "AutoStand",
    description:
      "Gerencie sua concessionária: vitrine, leads, vendas e marketing — num só lugar.",
    id: "/admin/dashboard",
    start_url: "/admin/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-BR",
    dir: "ltr",
    theme_color: "#0B1F33",
    background_color: "#F6F7F8",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
