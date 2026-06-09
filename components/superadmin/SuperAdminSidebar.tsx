"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, Handshake, LayoutDashboard, LogOut, Menu, Tag, X } from "lucide-react";
import { signOut } from "next-auth/react";

const NAV = [
  { href: "/superadmin/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/superadmin/tenants", label: "Concessionárias", icon: Building2 },
  { href: "/superadmin/parceiros", label: "Parceiros", icon: Handshake },
  { href: "/superadmin/cupons", label: "Cupons", icon: Tag },
];

export function SuperAdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = open ? "hidden" : prev;
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Header mobile */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-ink text-white border-b border-white/5">
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={open}
          className="p-1.5 -ml-1.5 rounded-md hover:bg-white/10 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-signal to-signal-dark flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-tight truncate">Plataforma</p>
            <p className="text-[11px] text-n400 truncate">Console whitelabel</p>
          </div>
        </div>
      </header>

      {open && (
        <button
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm cursor-pointer"
        />
      )}

      <aside
        className={`fixed lg:sticky inset-y-0 left-0 z-50 lg:z-auto top-0 lg:top-0 w-64 shrink-0 h-screen bg-ink text-n400 flex flex-col transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        aria-label="Menu de navegação"
      >
        <div className="px-6 py-6 border-b border-white/5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-signal to-signal-dark flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white leading-tight truncate">Plataforma</p>
              <p className="text-[11px] text-n600 truncate">Console whitelabel</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="lg:hidden p-1 -mr-1 rounded-md hover:bg-white/10 text-n400 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 py-5 px-3 space-y-1 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-signal/10 text-white ring-1 ring-signal"
                    : "text-n400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/5">
          <button
            onClick={() => signOut({ callbackUrl: "/superadmin/login" })}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-n400 hover:bg-danger/10 hover:text-danger transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
