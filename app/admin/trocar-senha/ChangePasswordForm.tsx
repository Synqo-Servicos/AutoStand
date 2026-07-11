"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input, Button } from "@/components/ui";

export function ChangePasswordForm({ redirectTo = "/admin/dashboard" }: { redirectTo?: string }) {
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
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-2xl border border-n100 shadow-sm p-6 space-y-4">
      {error && (
        <div className="rounded-lg bg-danger/10 border border-danger/30 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}
      <Field label="Nova senha">
        {(f) => (
          <Input
            id={f.id}
            type="password"
            autoFocus
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ao menos 8 caracteres"
          />
        )}
      </Field>
      <Field label="Confirme a nova senha">
        {(f) => (
          <Input
            id={f.id}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repita a senha"
          />
        )}
      </Field>
      <Button type="submit" loading={loading} className="w-full">
        Salvar e entrar
      </Button>
    </form>
  );
}
