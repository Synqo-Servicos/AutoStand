import Link from "next/link";
import { Logo } from "./Logo";

/** Cabeçalho do site institucional (autostand.com.br). */
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-n200 bg-n50/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" aria-label="AutoStand — início">
          <Logo tone="dark" />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-5">
          <Link
            href="/comprar"
            className="px-2 text-body-s font-medium text-n600 hover:text-ink"
          >
            Comprar carros
          </Link>
          <a
            href="/#como-funciona"
            className="hidden px-2 text-body-s font-medium text-n600 hover:text-ink sm:inline"
          >
            Como funciona
          </a>
          <a
            href="/#planos"
            className="hidden px-2 text-body-s font-medium text-n600 hover:text-ink sm:inline"
          >
            Planos
          </a>
          <Link
            href="/assinar"
            className="rounded-lg bg-signal px-4 py-2 text-body-s font-semibold text-ink transition-colors hover:bg-signal-dark"
          >
            Assinar
          </Link>
        </nav>
      </div>
    </header>
  );
}
