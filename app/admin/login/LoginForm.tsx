"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Field, Input, Button } from "@/components/ui";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setHasError(false);
    // redirect: false — o redirect server-side do Auth.js monta a URL a
    // partir do x-forwarded-host, que o Next standalone repõe com o
    // hostname interno do ECS atrás do ALB. Navegando no cliente, o
    // destino usa a origin real do navegador (domínio público da loja).
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setHasError(true);
      setLoading(false);
      return;
    }
    window.location.href = "/admin/dashboard";
  }

  return (
    <div className="bg-white rounded-2xl border border-n100 shadow-sm p-6">
      {hasError && (
        <div className="mb-4 rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
          Email ou senha incorretos.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" required>
          {(f) => (
            <Input
              id={f.id}
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          )}
        </Field>
        <Field label="Senha" required>
          {(f) => (
            <Input
              id={f.id}
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          )}
        </Field>
        <Button type="submit" loading={loading} className="w-full">
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-n500">
        <a href="/esqueci-senha" className="text-signal hover:underline">
          Esqueci minha senha
        </a>
      </p>
    </div>
  );
}
