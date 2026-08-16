import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/db";
import { hasFinanceAccess } from "@/lib/finance-access";
import { SuperAdminSidebar } from "@/components/superadmin/SuperAdminSidebar";
import { PlatformFooter } from "@/components/PlatformFooter";

export const dynamic = "force-dynamic";

/**
 * Route group do financeiro — o ÚNICO lugar do console que o papel
 * `contador` alcança.
 *
 * Ele existe separado de `(panel)` de propósito: `(panel)` gateia todas as
 * suas páginas num único `role !== "super_admin"`, e abrir o contador lá
 * abriria junto concessionárias, cupons, parceiros e diagnóstico. Com dois
 * grupos, página nova criada em `(panel)` **nasce fechada** ao contador —
 * o esquecimento nega acesso em vez de conceder.
 *
 * Não mover páginas do financeiro para `(panel)` nem o contrário.
 */
async function safeAuth() {
  try {
    return await auth();
  } catch {
    return null;
  }
}

export default async function SuperAdminFinanceiroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // O fence de host fica em app/superadmin/layout.tsx — aqui só auth.
  const session = await safeAuth();
  if (!session?.user || !hasFinanceAccess(session.user.role)) {
    redirect("/superadmin/login");
  }

  // Senha provisória → troca obrigatória antes de acessar o console.
  const user = await getUserById(Number(session.user.id));
  if (user?.must_change_password) redirect("/superadmin/trocar-senha");

  return (
    <div className="min-h-screen bg-n100 lg:flex">
      <SuperAdminSidebar role={session.user.role} />
      <div className="flex-1 min-w-0 lg:overflow-auto">
        {children}
        <PlatformFooter />
      </div>
    </div>
  );
}
