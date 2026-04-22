"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Phone } from "lucide-react";
import { DEALERSHIP_NAME, WHATSAPP_NUMBER } from "@/lib/constants";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const waHref = `https://wa.me/${WHATSAPP_NUMBER}`;

  return (
    <header className="fixed top-0 w-full z-50 bg-[#1E293B]/95 backdrop-blur-sm border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#DC2626] flex items-center justify-center font-bold text-white text-sm">
              PI
            </div>
            <span className="font-heading text-white font-bold text-sm tracking-wider hidden sm:block">
              {DEALERSHIP_NAME.toUpperCase()}
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {[["#estoque", "Estoque"], ["#sobre", "Sobre"], ["#contato", "Contato"]].map(([href, label]) => (
              <a key={href} href={href} className="text-sm text-slate-300 hover:text-white transition-colors">
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              Falar agora
            </a>
            <button
              onClick={() => setOpen(!open)}
              className="md:hidden w-9 h-9 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-[#1E293B] border-t border-white/10 px-4 py-4 space-y-3">
          {[["#estoque", "Estoque"], ["#sobre", "Sobre"], ["#contato", "Contato"]].map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="block text-sm text-slate-300 hover:text-white py-2">
              {label}
            </a>
          ))}
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#DC2626] text-white text-sm font-medium px-4 py-2 rounded-lg mt-2"
          >
            <Phone className="w-3.5 h-3.5" />
            Falar agora
          </a>
        </div>
      )}
    </header>
  );
}
