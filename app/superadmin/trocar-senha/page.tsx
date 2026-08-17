import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { auth } from "@/lib/auth";
import { hasFinanceAccess } from "@/lib/finance-access";
import { ChangePasswordForm } from "@/app/admin/trocar-senha/ChangePasswordForm";

export const dynamic = "force-dynamic";

/**
 * Troca de senha do console — fora de (panel) e de (financeiro) para não
 * conflitar com o gating que redireciona pra cá quando a senha é
 * provisória (evita loop).
 *
 * O gate é `hasFinanceAccess` porque hoje quem alcança o console é
 * super_admin ou contador — exatamente esse conjunto. Quem entra no
 * console precisa poder trocar a própria senha: com o gate antigo
 * (`super_admin` e mais ninguém) o contador provisionado com senha
 * provisória caía aqui vindo de (financeiro), era rejeitado e voltava ao
 * login — beco sem saída, sem nunca conseguir trocar a senha.
 *
 * Se um dia surgir papel de console SEM escopo financeiro, este gate
 * precisa do seu próprio predicado — não vale afrouxar o do financeiro.
 */
export default async function SuperadminTrocarSenhaPage() {
  const session = await auth().catch(() => null);
  if (!session?.user || !hasFinanceAccess(session.user.role)) {
    redirect("/superadmin/login");
  }

  // Depois de trocar a senha, cada papel volta para o que ele alcança —
  // mandar o contador para /superadmin cairia em (panel) e o expulsaria
  // de novo para o login.
  const destino =
    session.user.role === "contador" ? "/superadmin/financeiro" : "/superadmin";

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
        <ChangePasswordForm redirectTo={destino} />
      </div>
    </div>
  );
}
