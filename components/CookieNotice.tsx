"use client";

import { useState, useSyncExternalStore } from "react";

const KEY = "autostand.cookie-notice.v1";

// Store externo (localStorage) lido via useSyncExternalStore — evita setState em
// effect e o mismatch de hidratação: no server trata como "já dispensado" (não
// renderiza), no cliente reconcilia com o valor real após a hidratação.
function subscribe() {
  return () => {};
}
const getSnapshot = () => localStorage.getItem(KEY) !== null;
const getServerSnapshot = () => true;

/**
 * Aviso de cookies da plataforma. Como usamos apenas cookies essenciais, é um
 * aviso informativo dispensável (não opt-in bloqueante). Persistido em
 * localStorage. Renderizado só no site institucional (não no storefront
 * whitelabel do lojista).
 */
export function CookieNotice() {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [justDismissed, setJustDismissed] = useState(false);

  if (dismissed || justDismissed) return null;

  function dismiss() {
    localStorage.setItem(KEY, "1");
    setJustDismissed(true);
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-xl border border-n200 bg-white p-4 shadow-lg sm:flex sm:items-center sm:gap-4">
      <p className="text-body-s text-n700">
        Usamos apenas cookies essenciais para o funcionamento da plataforma. Saiba
        mais na nossa{" "}
        <a href="/privacidade" className="text-signal underline">
          Política de Privacidade
        </a>
        .
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="mt-3 w-full shrink-0 rounded-lg bg-ink px-4 py-2 text-body-s font-semibold text-white hover:bg-ink-800 sm:mt-0 sm:w-auto"
      >
        Entendi
      </button>
    </div>
  );
}
