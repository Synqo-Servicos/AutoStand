"use client";

import { useEffect } from "react";

/**
 * Registra o service worker (`/sw.js`) que habilita o PWA (instalável +
 * fallback offline). Só roda em produção e quando o browser suporta SW —
 * em dev evita interferência no HMR do Next.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // best-effort: a ausência do SW não quebra o app
      });
    };

    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
