import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAdminTenant } from "@/lib/tenant";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { SubscriptionBanner } from "@/components/admin/SubscriptionBanner";

async function safeAuth() {
  try {
    return await auth();
  } catch {
    return null;
  }
}

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  // Aceita loja suspensa — o painel funciona antes do pagamento (Fase 6).
  const tenant = await getAdminTenant();

  // Token de admin ausente, expirado, com assinatura inválida ou qualquer
  // outra falha de auth → manda pro login. auth() devolve null para os
  // casos comuns; a função abaixo blinda contra exceções de validação do JWT.
  const session = await safeAuth();
  if (!session?.user) redirect("/admin/login");

  // Only this tenant's own admin may enter its panel.
  if (session.user.role !== "tenant_admin" || session.user.tenantId !== tenant.id) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-n50 lg:flex">
      <AdminSidebar tenantName={tenant.name} />
      <div className="flex-1 min-w-0 lg:overflow-auto">
        {tenant.status !== "active" && <SubscriptionBanner />}
        {children}
      </div>
    </div>
  );
}
