"use client";

import { type HTMLAttributes, type ReactNode } from "react";
import * as RD from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

type Size = "sm" | "md" | "lg" | "xl";

const sizes: Record<Size, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

export interface ModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Render do trigger. Use `asChild` por dentro pra encadear no seu botão. */
  trigger?: ReactNode;
  size?: Size;
  /** Título obrigatório (acessibilidade). Pode ser visualmente escondido. */
  title: ReactNode;
  /** Descrição opcional — fica abaixo do título. */
  description?: ReactNode;
  /** Esconde visualmente o título; permanece pro screen reader. */
  hideTitle?: boolean;
  /** Ações no footer; já vêm com border-top e alignment. */
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Modal({
  open,
  onOpenChange,
  trigger,
  size = "md",
  title,
  description,
  hideTitle,
  footer,
  children,
  className,
}: ModalProps) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RD.Trigger asChild>{trigger}</RD.Trigger>}
      <RD.Portal>
        <RD.Overlay
          className={cn(
            "fixed inset-0 z-[var(--z-overlay)] bg-ink-900/50 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <RD.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[var(--z-modal)] -translate-x-1/2 -translate-y-1/2",
            "w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl",
            "max-h-[calc(100vh-3rem)] overflow-hidden flex flex-col",
            sizes[size],
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            className,
          )}
        >
          <header className="flex items-start gap-4 px-6 pt-6 pb-4 border-b border-n100">
            <div className="min-w-0 flex-1">
              <RD.Title
                className={cn(
                  "font-display text-h3 text-ink",
                  hideTitle && "sr-only",
                )}
              >
                {title}
              </RD.Title>
              {description && !hideTitle && (
                <RD.Description className="mt-1 text-body-s text-n600">
                  {description}
                </RD.Description>
              )}
            </div>
            <RD.Close
              className={cn(
                "shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md",
                "text-n600 hover:bg-n100 hover:text-ink transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
              )}
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </RD.Close>
          </header>
          <div className="px-6 py-5 overflow-y-auto text-body text-ink">{children}</div>
          {footer && (
            <footer className="flex items-center justify-end gap-3 px-6 py-4 border-t border-n100 bg-n50">
              {footer}
            </footer>
          )}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

/** Wrapper de seção interno ao body do Modal — pra organizar quando tem campos múltiplos. */
export function ModalSection({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return <section className={cn("space-y-3", className)} {...rest} />;
}
