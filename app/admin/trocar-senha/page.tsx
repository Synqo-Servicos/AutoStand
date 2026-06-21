import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { auth } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

/**
 * Troca de senha — fica FORA de (protected) para não conflitar com o gating
 * que redireciona pra cá quando a senha é provisória (evita loop).
 */
export default async function TrocarSenhaPage() {
  const session = await auth().catch(() => null);
  if (!session?.user || session.user.role !== "tenant_admin") {
    redirect("/admin/login");
  }
  const tenant = await getCurrentTenant();
  const accent = tenant?.accent_color ?? "#DC2626";

  return (
    <div className="min-h-screen bg-n50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white mx-auto mb-3"
            style={{ backgroundColor: accent }}
          >
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-ink">Defina sua senha</h1>
          <p className="text-sm text-n600 mt-1">
            Você entrou com uma senha provisória. Crie uma senha só sua para continuar.
          </p>
        </div>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
