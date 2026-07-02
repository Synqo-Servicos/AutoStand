import next from "eslint-config-next";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "obsidian-vault/**",
      "next-env.d.ts",
    ],
  },
  ...next,
  {
    // react-pdf renderiza para PDF, não HTML — regras de escape de
    // entidades HTML não se aplicam (`&quot;` sairia literal no PDF).
    files: ["components/pdf/**/*.{ts,tsx}"],
    rules: { "react/no-unescaped-entities": "off" },
  },
  {
    // Rotas .tsx usam next/og ImageResponse: geram imagem raster, não DOM.
    // `<img>` é obrigatório e `alt` não faz sentido nesse contexto.
    files: ["app/**/route.tsx"],
    rules: {
      "@next/next/no-img-element": "off",
      "jsx-a11y/alt-text": "off",
    },
  },
];

export default eslintConfig;
