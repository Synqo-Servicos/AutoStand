import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/db";
import { SuperAdminSidebar } from "@/components/superadmin/SuperAdminSidebar";

export const dynamic = "force-dynamic";

async function safeAuth() {
  try {
    return await auth();
  } catch {
    return null;
  }
}

export default async function SuperAdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // O fence de host fica em app/superadmin/layout.tsx — aqui só auth.
  const session = await safeAuth();
  if (!session?.user || session.user.role !== "super_admin") {
    redirect("/superadmin/login");
  }

  // Senha provisória → troca obrigatória antes de acessar o console.
  const user = await getUserById(Number(session.user.id));
  if (user?.must_change_password) redirect("/superadmin/trocar-senha");

  return (
    <div className="min-h-screen bg-n100 lg:flex">
      <SuperAdminSidebar />
      <div className="flex-1 min-w-0 lg:overflow-auto">{children}</div>
    </div>
  );
}
