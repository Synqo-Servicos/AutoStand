"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, Phone } from "lucide-react";
import { useTenant, tenantInitials } from "@/components/TenantContext";

/**
 * Navbar do storefront com dois estados:
 *  - top   (scrollY ≤ 24): transparente sobre o hero, sem sombra
 *  - down  (scrollY > 24): fundo --brand-primary/95 + blur + shadow
 *
 * Textos usam tokens `text-white/N` em vez de cores fixas (n300, slate-*)
 * para manter contraste WCAG sobre qualquer cor primária da loja —
 * inclusive primárias claras, onde n300 quebrava antes.
 */
export function Navbar() {
  const tenant = useTenant();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const waHref = tenant.whatsapp_number ? `https://wa.me/${tenant.whatsapp_number}` : null;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={
        "fixed top-0 w-full z-50 transition-[background-color,backdrop-filter,box-shadow,border-color,height] duration-200 ease-out " +
        (scrolled
          ? "bg-[var(--brand-primary)]/95 backdrop-blur-md shadow-sm border-b border-white/10"
          : "bg-transparent border-b border-transparent")
      }
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={
            "flex items-center justify-between transition-[height] duration-200 ease-out " +
            (scrolled ? "h-14" : "h-16")
          }
        >
          <Link href="/" className="flex items-center gap-3">
            {tenant.logo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={tenant.logo_url} alt={tenant.name} className="h-8 w-auto" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-[var(--brand-accent)] flex items-center justify-center font-bold text-white text-sm">
                {tenantInitials(tenant.name)}
              </div>
            )}
            <span className="font-display text-white font-semibold text-sm tracking-wide hidden sm:block">
              {tenant.name}
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            {[["#estoque", "Estoque"], ["#sobre", "Sobre"], ["#contato", "Contato"]].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="text-body-s font-medium text-white/80 transition-colors hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:inline-flex items-center gap-2 bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-d)] text-white text-body-s font-medium px-4 py-2 rounded-md transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                Falar agora
              </a>
            )}
            <button
              onClick={() => setOpen(!open)}
              aria-label={open ? "Fechar menu" : "Abrir menu"}
              aria-expanded={open}
              className="md:hidden w-9 h-9 flex items-center justify-center text-white/80 hover:text-white cursor-pointer"
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-[var(--brand-primary)] border-t border-white/10 px-4 py-4 space-y-3">
          {[["#estoque", "Estoque"], ["#sobre", "Sobre"], ["#contato", "Contato"]].map(([href, label]) => (
            <a
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="block text-body-s font-medium text-white/80 hover:text-white py-2"
            >
              {label}
            </a>
          ))}
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-[var(--brand-accent)] text-white text-body-s font-medium px-4 py-2 rounded-md mt-2"
            >
              <Phone className="w-3.5 h-3.5" />
              Falar agora
            </a>
          )}
        </div>
      )}
    </header>
  );
}
