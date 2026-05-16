"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export function LoginForm() {
  const sp = useSearchParams();
  const hasError = sp.get("error") === "CredentialsSignin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await signIn("credentials", { email, password, callbackUrl: "/admin/dashboard" });
    setLoading(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-n100 shadow-sm p-6">
      {hasError && (
        <div className="mb-4 rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
          Email ou senha incorretos.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-n600 mb-1">Email</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full border border-n200 rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-signal focus:border-transparent transition-shadow"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-n600 mb-1">Senha</label>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full border border-n200 rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-signal focus:border-transparent transition-shadow"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-signal text-ink text-sm font-medium rounded-lg hover:bg-signal-dark disabled:opacity-50 transition-colors cursor-pointer"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
