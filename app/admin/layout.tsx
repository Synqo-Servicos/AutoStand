import { redirect } from "next/navigation";
import { getRequestHost, isPlatformHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * Painel administrativo só existe em hosts de tenant
 * (<slug>.autostand.com.br ou domínio próprio).
 *
 * Em autostand.com.br (host da plataforma) não há tenant, então o /admin
 * não tem como funcionar — login resolve mas o callback cai em /admin/dashboard
 * sem tenant e dispara notFound(). Em vez disso, mandamos o visitante para
 * o diretório de lojas, de onde ele acha o subdomínio certo.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const host = await getRequestHost();
  if (isPlatformHost(host)) redirect("/lojas");
  return <>{children}</>;
}
