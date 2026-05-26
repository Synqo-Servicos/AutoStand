import { type ComponentType, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Estado vazio em 3 elementos (SPEC §4.3): ícone — mensagem em duas
 * camadas — CTA. Sempre usar em listagens vazias; nunca um parágrafo
 * cinza solto.
 */
export interface EmptyStateProps {
  /** Ícone Lucide ou outro componente que aceita className. */
  icon?: ComponentType<{ className?: string }>;
  /** Linha 1 — clara, do que está vazio. */
  title: ReactNode;
  /** Linha 2 — por quê / o que fazer. */
  description?: ReactNode;
  /** Botão/link principal de ação. */
  cta?: ReactNode;
  /** Ação secundária discreta abaixo do CTA. */
  secondary?: ReactNode;
  /** `compact` reduz padding e tamanho de ícone — usar dentro de cards. */
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
  secondary,
  compact,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-10 px-4" : "py-20 px-6",
        className,
      )}
    >
      {Icon && (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-n100 text-n500 mb-4",
            compact ? "h-12 w-12" : "h-16 w-16",
          )}
        >
          <Icon className={compact ? "h-5 w-5" : "h-7 w-7"} />
        </div>
      )}
      <p className={cn("font-medium text-ink", compact ? "text-body" : "text-body-l")}>
        {title}
      </p>
      {description && (
        <p className="mt-1 max-w-sm text-body-s text-n600">{description}</p>
      )}
      {cta && <div className="mt-6">{cta}</div>}
      {secondary && <div className="mt-3">{secondary}</div>}
    </div>
  );
}
