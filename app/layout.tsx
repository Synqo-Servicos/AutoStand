import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { PLATFORM_ORIGIN } from "@/lib/platform";

export const metadata: Metadata = {
  metadataBase: new URL(PLATFORM_ORIGIN),
  title: "AutoStand",
  description: "Seminovos de concessionárias multimarca selecionadas, num só lugar.",
  applicationName: "AutoStand",
  appleWebApp: {
    capable: true,
    title: "AutoStand",
    statusBarStyle: "default",
  },
  openGraph: {
    siteName: "AutoStand",
    type: "website",
    locale: "pt_BR",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B1F33",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <ToastProvider />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
