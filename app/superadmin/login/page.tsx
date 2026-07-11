"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { Building2, Loader2 } from "lucide-react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setHasError(false);
    // redirect: false — ver nota em app/admin/login/LoginForm.tsx: evita o
    // redirect server-side do Auth.js que sai para o hostname interno do ECS.
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setHasError(true);
      setLoading(false);
      return;
    }
    window.location.href = "/superadmin/dashboard";
  }

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 p-6 backdrop-blur">
      {hasError && (
        <div className="mb-4 rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
          Email ou senha incorretos.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-n400 mb-1.5">Email</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white bg-white/5 placeholder-n600 focus:outline-none focus:ring-2 focus:ring-signal focus:border-transparent transition-shadow"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-n400 mb-1.5">Senha</label>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white bg-white/5 placeholder-n600 focus:outline-none focus:ring-2 focus:ring-signal focus:border-transparent transition-shadow"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-signal text-ink text-sm font-semibold rounded-lg hover:bg-signal-dark disabled:opacity-50 transition-colors cursor-pointer"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

export default function SuperAdminLoginPage() {
  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-signal to-signal-dark flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Console da Plataforma</h1>
          <p className="text-sm text-n600 mt-1">Acesso restrito — super-admin</p>
        </div>
        <Suspense fallback={<div className="bg-white/5 rounded-2xl border border-white/10 h-44" />}>
          <LoginForm />
        </Suspense>
        <p className="mt-8 text-center text-xs text-n500">
          <span className="font-display font-semibold text-n400">AutoStand</span> · por Synqo
        </p>
      </div>
    </div>
  );
}
