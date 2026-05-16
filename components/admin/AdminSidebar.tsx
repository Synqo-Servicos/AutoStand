"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Car, ArrowLeftRight, Users, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

const NAV = [
  { href: "/admin/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { href: "/admin/veiculos",   label: "Veículos",   icon: Car },
  { href: "/admin/transacoes", label: "Transações", icon: ArrowLeftRight },
  { href: "/admin/leads",      label: "Leads",      icon: Users },
];

export function AdminSidebar({ tenantName }: { tenantName: string }) {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 bg-white border-r border-n100 flex flex-col">
      <div className="px-6 py-5 border-b border-n100">
        <p className="text-xs font-semibold text-n400 uppercase tracking-widest">Admin</p>
        <p className="text-sm font-semibold text-ink mt-0.5 truncate">{tenantName}</p>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-signal/10 text-signal"
                  : "text-n600 hover:bg-n50 hover:text-ink"
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
  );
}
