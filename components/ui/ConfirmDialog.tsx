"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Estilo de ação destrutiva (botão vermelho). */
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
}

/**
 * Confirmação em Modal (substitui `window.confirm`). Uso:
 *
 *   const { confirm, dialog } = useConfirm();
 *   ...
 *   if (!(await confirm({ title: "Apagar?", danger: true }))) return;
 *   ...
 *   return (<>{dialog} ...</>);
 *
 * Promessa resolve `true` no confirmar, `false` no cancelar/fechar.
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setState({ ...opts, open: true });
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setState((s) => (s ? { ...s, open: false } : null));
  }, []);

  const dialog: ReactNode = state ? (
    <Modal
      open={state.open}
      onOpenChange={(o) => {
        if (!o) settle(false);
      }}
      size="sm"
      title={state.title}
      description={state.description}
      footer={
        <>
          <Button variant="ghost" onClick={() => settle(false)}>
            {state.cancelLabel ?? "Cancelar"}
          </Button>
          <Button variant={state.danger ? "danger" : "primary"} onClick={() => settle(true)}>
            {state.confirmLabel ?? "Confirmar"}
          </Button>
        </>
      }
    />
  ) : null;

  return { confirm, dialog };
}
