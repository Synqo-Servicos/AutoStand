import Link from "next/link";
import { DEALERSHIP_NAME, BUSINESS_HOURS, WHATSAPP_NUMBER, DEALERSHIP_INSTAGRAM } from "@/lib/constants";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-[#0F172A] text-slate-400 py-12 px-4">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-[#DC2626] flex items-center justify-center font-bold text-white text-xs">PI</div>
            <span className="text-white font-heading font-bold text-xs tracking-wider">{DEALERSHIP_NAME.toUpperCase()}</span>
          </div>
          <p className="text-sm">Seminovos com procedência em Maceió, Alagoas.</p>
        </div>
        <div>
          <p className="text-white text-sm font-semibold mb-2">Horário</p>
          <p className="text-sm">{BUSINESS_HOURS}</p>
        </div>
        <div>
          <p className="text-white text-sm font-semibold mb-2">Contato</p>
          <div className="space-y-1 text-sm">
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors block">WhatsApp</a>
            <a href={DEALERSHIP_INSTAGRAM} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors block">Instagram</a>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-white/10 flex items-center justify-between text-xs">
        <span>© {year} {DEALERSHIP_NAME}</span>
        <Link href="/admin" className="hover:text-white transition-colors">Admin</Link>
      </div>
    </footer>
  );
}
