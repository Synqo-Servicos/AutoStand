import { cn } from "@/lib/cn";

/**
 * Footer institucional da plataforma (áreas admin e super-admin). Dá identidade
 * "AutoStand · por Synqo" — antes o shell administrativo não tinha nenhuma marca,
 * o que fazia parecer ferramenta interna. NÃO é o footer do storefront do lojista
 * (esse é whitelabel, em components/public/Footer.tsx).
 */
export function PlatformFooter({ className }: { className?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer className={cn("border-t border-n150 px-6 py-5", className)}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 text-body-s text-n500">
        <span className="font-display font-semibold tracking-tight text-ink">
          Auto<span className="text-signal">Stand</span>
        </span>
        <span className="flex items-center gap-2">
          <span>© {year}</span>
          <span className="text-n300" aria-hidden>
            ·
          </span>
          <span>por Synqo</span>
          <span className="text-n300" aria-hidden>
            ·
          </span>
          <a
            href="mailto:contato.synqo@gmail.com"
            className="transition-colors hover:text-ink"
          >
            Ajuda
          </a>
        </span>
      </div>
    </footer>
  );
}
