import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const tenant = await requireTenant();
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  // Only this tenant's own admin may enter its panel.
  if (session.user.role !== "tenant_admin" || session.user.tenantId !== tenant.id) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen bg-n50">
      <AdminSidebar tenantName={tenant.name} />
      <div className="flex-1 min-w-0 overflow-auto">
        {children}
      </div>
    </div>
  );
}
