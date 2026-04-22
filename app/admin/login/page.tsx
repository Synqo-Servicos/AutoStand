"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DEALERSHIP_NAME } from "@/lib/constants";

function LoginForm() {
  const sp = useSearchParams();
  const hasError = sp.get("error") === "CredentialsSignin";
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await signIn("credentials", { email, password, callbackUrl: "/admin/dashboard" });
    setLoading(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      {hasError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          Email ou senha incorretos.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
          <input
            required type="email" value={email} onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Senha</label>
          <input
            required type="password" value={password} onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[#DC2626] rounded-xl flex items-center justify-center font-bold text-white text-lg mx-auto mb-3">
            PI
          </div>
          <h1 className="text-xl font-bold text-slate-900">{DEALERSHIP_NAME}</h1>
          <p className="text-sm text-slate-500 mt-1">Área administrativa</p>
        </div>
        <Suspense fallback={<div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 h-40" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
