import { redirect } from "next/navigation";
import { Navbar } from "@/components/public/Navbar";
import { Footer } from "@/components/public/Footer";
import { WhatsAppFAB } from "@/components/public/WhatsAppFAB";
import { TenantProvider } from "@/components/TenantContext";
import { getRequestHost, isPlatformHost, requireTenant } from "@/lib/tenant";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // On a platform host there is no storefront — send visitors to the console.
  const host = await getRequestHost();
  if (isPlatformHost(host)) redirect("/superadmin");

  const tenant = await requireTenant();

  // Per-tenant theme — consumed by `var(--brand-*)` classes across the storefront.
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
