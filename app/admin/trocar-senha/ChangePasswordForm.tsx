"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function ChangePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("A senha precisa de ao menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível trocar a senha.");
      setLoading(false);
      return;
    }
    // Senha trocada → flag limpa no banco; o painel para de redirecionar.
    router.replace("/admin/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-2xl border border-n100 shadow-sm p-6 space-y-4">
      {error && (
        <div className="rounded-lg bg-danger/10 border border-danger/30 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-n600 mb-1">Nova senha</label>
        <input
          type="password"
          autoFocus
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          placeholder="Ao menos 8 caracteres"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-n600 mb-1">Confirme a nova senha</label>
        <input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
          placeholder="Repita a senha"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 bg-signal text-ink text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-signal-dark disabled:opacity-50 transition-colors cursor-pointer"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Salvar e entrar
      </button>
    </form>
  );
}

const inputClass =
  "w-full border border-n200 rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-signal focus:border-transparent transition-shadow";
