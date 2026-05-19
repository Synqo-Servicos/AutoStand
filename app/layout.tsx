import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(`https://${(process.env.PLATFORM_DOMAIN ?? "autostand.com.br").trim()}`),
  title: "AutoStand",
  description: "Seminovos de concessionárias multimarca selecionadas, num só lugar.",
  openGraph: {
    siteName: "AutoStand",
    type: "website",
    locale: "pt_BR",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
