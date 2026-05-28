"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { PartnerBanks } from "@/components/public/PartnerBanks";
import { useTenant, tenantInitials } from "@/components/TenantContext";

interface SocialLink {
  label: string;
  href: string;
}

export function Footer() {
  const tenant = useTenant();
  const year = new Date().getFullYear();

  // Coleta as redes preenchidas na ordem em que devem aparecer no footer.
  const socials: SocialLink[] = [
    tenant.instagram_url && { label: "Instagram", href: tenant.instagram_url },
    tenant.facebook_url && { label: "Facebook", href: tenant.facebook_url },
    tenant.youtube_url && { label: "YouTube", href: tenant.youtube_url },
    tenant.tiktok_url && { label: "TikTok", href: tenant.tiktok_url },
    tenant.twitter_url && { label: "X (Twitter)", href: tenant.twitter_url },
  ].filter(Boolean) as SocialLink[];

  return (
    <footer className="bg-[var(--brand-primary-d)] text-n400 py-12 px-4">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-[var(--brand-accent)] flex items-center justify-center font-bold text-white text-xs">
              {tenantInitials(tenant.name)}
            </div>
            <span className="text-white font-display font-bold text-xs tracking-wider">
              {tenant.name.toUpperCase()}
            </span>
          </div>
          <p className="text-sm">
            Seminovos com procedência{tenant.city ? ` em ${tenant.city}` : ""}.
          </p>
          {tenant.address && (
            <p className="mt-3 flex items-start gap-1.5 text-sm">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{tenant.address}</span>
            </p>
          )}
        </div>

        <div>
          <p className="text-white text-sm font-semibold mb-2">Horário</p>
          <p className="text-sm">{tenant.business_hours ?? "Consulte pelo WhatsApp"}</p>
        </div>

        <div>
          <p className="text-white text-sm font-semibold mb-2">Contato</p>
          <div className="space-y-1 text-sm">
            {tenant.whatsapp_number && (
              <a
                href={`https://wa.me/${tenant.whatsapp_number}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors block"
              >
                WhatsApp
              </a>
            )}
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors block"
              >
                {s.label}
              </a>
            ))}
            {tenant.contact_email && (
              <a
                href={`mailto:${tenant.contact_email}`}
                className="hover:text-white transition-colors block"
              >
                {tenant.contact_email}
              </a>
            )}
          </div>
        </div>
      </div>

      {tenant.partner_banks && tenant.partner_banks.length > 0 && (
        <div className="max-w-7xl mx-auto mt-10 pt-8 border-t border-white/10">
          <PartnerBanks slugs={tenant.partner_banks} variant="footer" />
        </div>
      )}

      <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-white/10 flex items-center justify-between text-xs">
        <span>© {year} {tenant.name}</span>
        <Link href="/admin" className="hover:text-white transition-colors">Admin</Link>
      </div>
    </footer>
  );
}
