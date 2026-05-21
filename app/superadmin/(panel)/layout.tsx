import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRequestHost, isPlatformHost } from "@/lib/tenant";
import { SuperAdminSidebar } from "@/components/superadmin/SuperAdminSidebar";

export const dynamic = "force-dynamic";

export default async function SuperAdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The platform console only exists on platform hosts, never on a tenant domain.
  const host = await getRequestHost();
  if (!isPlatformHost(host)) notFound();

  const session = await auth();
  if (!session?.user || session.user.role !== "super_admin") {
    redirect("/superadmin/login");
  }

  return (
    <div className="min-h-screen bg-n100 lg:flex">
      <SuperAdminSidebar />
      <div className="flex-1 min-w-0 lg:overflow-auto">{children}</div>
    </div>
  );
}
