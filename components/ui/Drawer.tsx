"use client";

import { type ReactNode } from "react";
import * as RD from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

type Side = "left" | "right" | "bottom";

/**
 * Drawer construído sobre Radix Dialog — quase API igual ao `<Modal>`,
 * mas posicionado em uma borda da tela. Pensado pra:
 *  - Filtros mobile do marketplace (side="right")
 *  - Menus contextuais densos (side="left")
 *  - Action sheets (side="bottom")
 */
export interface DrawerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  side?: Side;
  title: ReactNode;
  description?: ReactNode;
  hideTitle?: boolean;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const sideStyles: Record<Side, string> = {
  left: cn(
    "inset-y-0 left-0 h-full w-[88vw] max-w-sm",
    "data-[state=open]:animate-in data-[state=open]:slide-in-from-left",
    "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left",
  ),
  right: cn(
    "inset-y-0 right-0 h-full w-[88vw] max-w-sm",
    "data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
    "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right",
  ),
  bottom: cn(
    "inset-x-0 bottom-0 w-full max-h-[85vh] rounded-t-2xl",
    "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom",
    "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
  ),
};

export function Drawer({
  open,
  onOpenChange,
  trigger,
  side = "right",
  title,
  description,
  hideTitle,
  footer,
  children,
  className,
}: DrawerProps) {
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
            "fixed z-[var(--z-modal)] bg-white shadow-xl flex flex-col",
            sideStyles[side],
            className,
          )}
        >
          <header className="flex items-start gap-4 px-5 pt-5 pb-4 border-b border-n100">
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
          <div className="flex-1 overflow-y-auto px-5 py-5 text-body text-ink">{children}</div>
          {footer && (
            <footer className="flex items-center justify-end gap-3 px-5 py-4 border-t border-n100 bg-n50">
              {footer}
            </footer>
          )}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
