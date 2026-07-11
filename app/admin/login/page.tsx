import { Suspense } from "react";
import { getCurrentTenant } from "@/lib/tenant";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default async function LoginPage() {
  const tenant = await getCurrentTenant();
  const name = tenant?.name ?? "Painel administrativo";
  const accent = tenant?.accent_color ?? "#FF6A1A";

  return (
    <div className="min-h-screen bg-n50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-lg mx-auto mb-3"
            style={{ backgroundColor: accent }}
          >
            {tenant ? initials(tenant.name) : "PI"}
          </div>
          <h1 className="text-xl font-bold text-ink">{name}</h1>
          <p className="text-sm text-n600 mt-1">Área administrativa</p>
        </div>
        <Suspense fallback={<div className="bg-white rounded-2xl border border-n100 shadow-sm p-6 h-40" />}>
          <LoginForm />
        </Suspense>
        <p className="mt-8 text-center text-xs text-n500">
          <span className="font-display font-semibold text-n600">AutoStand</span> · por Synqo
        </p>
      </div>
    </div>
  );
}
