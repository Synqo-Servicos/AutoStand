import { Navbar } from "@/components/public/Navbar";
import { Footer } from "@/components/public/Footer";
import { WhatsAppFAB } from "@/components/public/WhatsAppFAB";
import { TenantProvider } from "@/components/TenantContext";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { getRequestHost, isPlatformHost, requireTenant } from "@/lib/tenant";

/**
 * Layout do grupo público — ramifica por host:
 *  - host da plataforma → site institucional AutoStand (chrome de marketing);
 *  - host de tenant     → vitrine whitelabel da concessionária.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const host = await getRequestHost();

  // Site institucional da plataforma (autostand.com.br).
  if (isPlatformHost(host)) {
    return (
      <div className="flex min-h-screen flex-col bg-n50">
        <MarketingHeader />
        <main className="flex-1">{children}</main>
        <MarketingFooter />
      </div>
    );
  }

  // Storefront da concessionária — tema por tenant via var(--brand-*).
  const tenant = await requireTenant();
  const themeStyle = {
    "--brand-primary": tenant.primary_color,
    "--brand-primary-d": `color-mix(in srgb, ${tenant.primary_color}, black 28%)`,
    "--brand-primary-l": `color-mix(in srgb, ${tenant.primary_color}, white 14%)`,
    "--brand-accent": tenant.accent_color,
    "--brand-accent-d": tenant.accent_dark_color,
  } as React.CSSProperties;

  return (
    <TenantProvider tenant={tenant}>
      <div style={themeStyle}>
        <Navbar />
        <main className="pt-16">{children}</main>
        <Footer />
        <WhatsAppFAB />
      </div>
    </TenantProvider>
  );
}
