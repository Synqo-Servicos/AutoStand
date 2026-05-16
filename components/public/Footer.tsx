"use client";

import Link from "next/link";
import { useTenant, tenantInitials } from "@/components/TenantContext";

export function Footer() {
  const tenant = useTenant();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[var(--brand-primary-d)] text-slate-400 py-12 px-4">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-[var(--brand-accent)] flex items-center justify-center font-bold text-white text-xs">
              {tenantInitials(tenant.name)}
            </div>
            <span className="text-white font-heading font-bold text-xs tracking-wider">
              {tenant.name.toUpperCase()}
            </span>
          </div>
          <p className="text-sm">
            Seminovos com procedência{tenant.city ? ` em ${tenant.city}` : ""}.
          </p>
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
            {tenant.instagram_url && (
              <a
                href={tenant.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors block"
              >
                Instagram
              </a>
            )}
            {tenant.contact_email && (
              <a href={`mailto:${tenant.contact_email}`} className="hover:text-white transition-colors block">
                {tenant.contact_email}
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-white/10 flex items-center justify-between text-xs">
        <span>© {year} {tenant.name}</span>
        <Link href="/admin" className="hover:text-white transition-colors">Admin</Link>
      </div>
    </footer>
  );
}
