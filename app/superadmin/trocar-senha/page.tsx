import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { auth } from "@/lib/auth";
import { ChangePasswordForm } from "@/app/admin/trocar-senha/ChangePasswordForm";

export const dynamic = "force-dynamic";

/**
 * Troca de senha do super-admin — fora de (panel) para não conflitar com o
 * gating que redireciona pra cá quando a senha é provisória (evita loop).
 */
export default async function SuperadminTrocarSenhaPage() {
  const session = await auth().catch(() => null);
  if (!session?.user || session.user.role !== "super_admin") {
    redirect("/superadmin/login");
  }

  return (
    <div className="min-h-screen bg-n100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white mx-auto mb-3 bg-ink">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-ink">Defina sua senha</h1>
          <p className="text-sm text-n600 mt-1">
            Você entrou com uma senha provisória. Crie uma senha só sua para continuar.
          </p>
        </div>
        <ChangePasswordForm redirectTo="/superadmin" />
      </div>
    </div>
  );
}
