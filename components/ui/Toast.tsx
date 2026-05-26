"use client";

import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";

/**
 * Provider de toasts — colocar uma única vez na raiz da árvore
 * (ex.: `app/layout.tsx`). Posicionado top-right; tema escuro
 * dispensado em favor de fundo branco + barra colorida lateral.
 */
export function ToastProvider() {
  return (
    <SonnerToaster
      position="top-right"
      gap={12}
      duration={4000}
      closeButton
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "group bg-white text-ink rounded-xl shadow-lg border border-n200 px-4 py-3 font-body",
          title: "font-medium text-ink text-body-s",
          description: "text-body-s text-n600 mt-0.5",
          icon: "shrink-0",
          actionButton:
            "bg-ink text-white px-3 py-1 rounded-md text-body-s font-medium",
          cancelButton:
            "text-n600 hover:text-ink text-body-s font-medium",
          closeButton:
            "bg-transparent text-n500 hover:text-ink",
        },
      }}
      icons={{
        success: <CheckCircle2 className="h-5 w-5 text-success" />,
        error: <AlertCircle className="h-5 w-5 text-danger" />,
        warning: <AlertTriangle className="h-5 w-5 text-warning-dark" />,
        info: <Info className="h-5 w-5 text-ink" />,
      }}
    />
  );
}

/**
 * Helper tipado. Use direto: `toast.success("Salvo")` ou `toast("Mensagem")`.
 * Mantém compatibilidade com a API do sonner caso precise.
 */
export const toast = sonnerToast;
