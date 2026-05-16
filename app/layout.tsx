import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Concessionária de veículos",
  description: "Seminovos com procedência.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
