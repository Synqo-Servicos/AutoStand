"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeftRight, Car, CreditCard, LayoutDashboard, LogOut, Menu, Palette,
  Sparkles, Store, TrendingUp, Users, X,
} from "lucide-react";
import { signOut } from "next-auth/react";

const NAV = [
  { href: "/admin/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { href: "/admin/veiculos",     label: "Veículos",     icon: Car },
  { href: "/admin/transacoes",   label: "Transações",   icon: ArrowLeftRight },
  { href: "/admin/leads",        label: "Leads",        icon: Users },
  { href: "/admin/personalizar", label: "Personalizar", icon: Palette },
  { href: "/admin/analise",      label: "Análise IA",   icon: Sparkles },
  { href: "/admin/inteligencia", label: "Inteligência", icon: TrendingUp },
  { href: "/admin/marketplace",  label: "Marketplace",  icon: Store },
  { href: "/admin/assinatura",   label: "Assinatura",   icon: CreditCard },
];

export function AdminSidebar({ tenantName }: { tenantName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Fecha o drawer ao navegar para outra rota.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // No mobile: trava o scroll do body enquanto o drawer está aberto.
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
      {/* Header mobile (visível só abaixo de lg) */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-white border-b border-n100">
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={open}
          className="p-1.5 -ml-1.5 rounded-md hover:bg-n50 text-ink cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-n400 uppercase tracking-widest leading-none">Admin</p>
          <p className="text-sm font-semibold text-ink truncate mt-0.5">{tenantName}</p>
        </div>
      </header>

      {/* Backdrop — somente no mobile, quando aberto */}
      {open && (
        <button
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
          className="lg:hidden fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm cursor-pointer"
        />
      )}

      {/* Sidebar: drawer no mobile, sticky no desktop */}
      <aside
        className={`fixed lg:sticky inset-y-0 left-0 z-50 lg:z-auto top-0 lg:top-0 w-60 shrink-0 h-screen bg-white border-r border-n100 flex flex-col transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        aria-label="Menu de navegação"
      >
        <div className="px-6 py-5 border-b border-n100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-n400 uppercase tracking-widest">Admin</p>
            <p className="text-sm font-semibold text-ink mt-0.5 truncate">{tenantName}</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="lg:hidden p-1 -mr-1 rounded-md hover:bg-n50 text-n600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active ? "bg-signal/10 text-signal" : "text-n600 hover:bg-n50 hover:text-ink"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-n100">
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-n600 hover:bg-danger/10 hover:text-danger transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
