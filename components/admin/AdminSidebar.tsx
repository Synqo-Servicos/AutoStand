"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeftRight, Car, CreditCard, FileText, LayoutDashboard, LogOut, Menu, Palette,
  PiggyBank, Sparkles, Store, TrendingUp, UserCircle2, Users, X,
} from "lucide-react";
import { signOut } from "next-auth/react";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operação",
    items: [
      { href: "/admin/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
      { href: "/admin/veiculos",   label: "Veículos",   icon: Car },
      { href: "/admin/documentos", label: "Documentos", icon: FileText },
    ],
  },
  {
    label: "Vendas",
    items: [
      { href: "/admin/leads",      label: "Leads",      icon: Users },
      { href: "/admin/transacoes", label: "Transações", icon: ArrowLeftRight },
      { href: "/admin/vendedores", label: "Vendedores", icon: UserCircle2 },
      { href: "/admin/financeiro", label: "Financeiro", icon: PiggyBank },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/admin/marketplace",  label: "Marketplace",  icon: Store },
      { href: "/admin/personalizar", label: "Personalizar", icon: Palette },
      { href: "/admin/analise",      label: "Análise IA",   icon: Sparkles },
      { href: "/admin/inteligencia", label: "Inteligência", icon: TrendingUp },
    ],
  },
  {
    label: "Conta",
    items: [
      { href: "/admin/assinatura", label: "Assinatura", icon: CreditCard },
    ],
  },
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
          <p className="text-eyebrow text-n500 leading-none">Admin</p>
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
            <p className="text-eyebrow text-n500">Admin</p>
            <p className="text-sm font-semibold text-ink mt-1 truncate">{tenantName}</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="lg:hidden p-2 -mr-1 rounded-md hover:bg-n50 text-n600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto" aria-label="Navegação principal">
          {NAV_GROUPS.map((group, idx) => (
            <div
              key={group.label}
              className={idx > 0 ? "mt-5 pt-4 border-t border-n100" : ""}
            >
              <p className="px-6 mb-1.5 text-eyebrow text-n500">{group.label}</p>
              <ul className="px-3 space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = pathname.startsWith(href);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors " +
                          (active
                            ? "bg-signal/10 text-signal"
                            : "text-n700 hover:bg-n50 hover:text-ink")
                        }
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
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
