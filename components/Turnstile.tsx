"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

/**
 * Widget invisível do Cloudflare Turnstile (CAPTCHA). Renderiza apenas
 * quando `NEXT_PUBLIC_TURNSTILE_SITE_KEY` está setada — em dev/local
 * sem a env, `isTurnstileEnabled()` retorna false e o formulário
 * passa um token vazio (que o servidor aceita via no-op).
 *
 * Setup em prod:
 *   - vercel env add NEXT_PUBLIC_TURNSTILE_SITE_KEY (public)
 *   - vercel env add TURNSTILE_SECRET_KEY            (server)
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

export function isTurnstileEnabled(): boolean {
  return Boolean(SITE_KEY);
}

interface TurnstileWindow {
  turnstile?: {
    render: (
      element: HTMLElement,
      options: {
        sitekey: string;
        callback?: (token: string) => void;
        "expired-callback"?: () => void;
        "error-callback"?: () => void;
        theme?: "light" | "dark" | "auto";
        size?: "normal" | "flexible" | "compact" | "invisible";
      },
    ) => string;
    remove: (widgetId: string) => void;
    reset: (widgetId?: string) => void;
  };
}

interface Props {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  theme?: "light" | "dark" | "auto";
}

/** Single-render widget — re-monta automaticamente quando props mudam. */
export function Turnstile({ onVerify, onExpire, theme = "light" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY) return;
    const w = window as unknown as TurnstileWindow;

    // O script pode ainda não ter carregado; polling curto até o
    // global `turnstile` aparecer. Quando carregar, renderiza o widget.
    const interval = window.setInterval(() => {
      if (!w.turnstile || !containerRef.current) return;
      window.clearInterval(interval);
      widgetIdRef.current = w.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: onVerify,
        "expired-callback": onExpire,
        theme,
      });
    }, 100);

    return () => {
      window.clearInterval(interval);
      if (widgetIdRef.current && w.turnstile) {
        try {
          w.turnstile.remove(widgetIdRef.current);
        } catch {
          // re-render rápido após unmount às vezes invalida o id; ignora.
        }
        widgetIdRef.current = null;
      }
    };
  }, [onVerify, onExpire, theme]);

  if (!SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />
      <div ref={containerRef} />
    </>
  );
}
