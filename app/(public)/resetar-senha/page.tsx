"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

const inputClass =
  "w-full border border-n200 rounded-lg px-3 py-2 text-sm text-ink bg-white " +
  "focus:outline-none focus:ring-2 focus:ring-signal focus:border-transparent";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("A senha precisa de pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não conferem.");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível redefinir a senha.");
        setLoading(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
    setLoading(false);
  }

  if (done) {
    return (
      <>
        <h1 className="font-display text-h3 text-ink">Senha redefinida ✓</h1>
        <p className="mt-4 text-body-s text-n600">Sua senha foi atualizada. Já pode entrar com ela.</p>
        <a
          href="/admin/login"
          className="mt-6 inline-block rounded-lg bg-signal px-4 py-2.5 text-sm font-medium text-ink hover:bg-signal-dark transition-colors"
        >
          Ir para o login
        </a>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-h3 text-ink">Redefinir senha</h1>
      {!token ? (
        <p className="mt-6 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
          Link inválido. Peça um novo em &ldquo;Esqueci minha senha&rdquo;.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nova senha (mín. 8 caracteres)"
            autoComplete="new-password"
            className={inputClass}
          />
          <input
            required
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirmar nova senha"
            autoComplete="new-password"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-signal px-4 py-2.5 text-sm font-medium text-ink hover:bg-signal-dark disabled:opacity-50 transition-colors cursor-pointer"
          >
            {loading ? "Salvando…" : "Redefinir senha"}
          </button>
        </form>
      )}
    </>
  );
}

export default function ResetarSenhaPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <Suspense fallback={<p className="text-body-s text-n600">Carregando…</p>}>
        <ResetForm />
      </Suspense>
    </main>
  );
}
