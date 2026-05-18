import Link from "next/link";
import { Logo } from "./Logo";

/** Rodapé do site institucional (autostand.com.br). */
export function MarketingFooter() {
  return (
    <footer className="border-t border-ink-800 bg-ink">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Logo tone="light" />
          <p className="mt-3 max-w-xs text-body-s text-n400">
            Seminovos de concessionárias multimarca selecionadas, num só lugar.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-body-s">
          <Link href="/comprar" className="text-n400 hover:text-white">
            Comprar carros
          </Link>
          <Link href="/lojas" className="text-n400 hover:text-white">
            Concessionárias
          </Link>
          <Link href="/anuncie" className="text-n400 hover:text-white">
            Anuncie sua loja
          </Link>
        </nav>
      </div>
      <div className="border-t border-ink-800 px-5 py-4">
        <p className="mx-auto max-w-6xl text-body-s text-n600">
          © {new Date().getFullYear()} AutoStand · autostand.com.br
        </p>
      </div>
    </footer>
  );
}
