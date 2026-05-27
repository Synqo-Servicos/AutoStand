import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { PLATFORM_ORIGIN } from "@/lib/platform";

export const metadata: Metadata = {
  metadataBase: new URL(PLATFORM_ORIGIN),
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
      <body>
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
