"use client";

import { useState } from "react";

const inputClass =
  "w-full border border-n200 rounded-lg px-3 py-2 text-sm text-ink bg-white " +
  "focus:outline-none focus:ring-2 focus:ring-signal focus:border-transparent";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Silencioso de propósito: sempre mostramos a mesma confirmação.
    }
    setSent(true);
    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-h3 text-ink">Esqueci minha senha</h1>
      {sent ? (
        <p className="mt-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha.
          Verifique sua caixa de entrada — e o spam.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <p className="text-body-s text-n600">
            Informe seu e-mail e enviaremos um link para criar uma nova senha.
          </p>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            autoComplete="email"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-signal px-4 py-2.5 text-sm font-medium text-ink hover:bg-signal-dark disabled:opacity-50 transition-colors cursor-pointer"
          >
            {loading ? "Enviando…" : "Enviar link"}
          </button>
        </form>
      )}
    </main>
  );
}
