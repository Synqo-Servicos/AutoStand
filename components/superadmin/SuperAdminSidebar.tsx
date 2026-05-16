"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, Handshake, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

const NAV = [
  { href: "/superadmin/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/superadmin/tenants", label: "Concessionárias", icon: Building2 },
  { href: "/superadmin/parceiros", label: "Parceiros", icon: Handshake },
];

export function SuperAdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 bg-ink text-n400 flex flex-col">
      <div className="px-6 py-6 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-signal to-signal-dark flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">Plataforma</p>
            <p className="text-[11px] text-n600">Console whitelabel</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-5 px-3 space-y-1">
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
  );
}
