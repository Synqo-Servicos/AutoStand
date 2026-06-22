import { requireConsoleHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * O console super-admin (login + painel) só existe no subdomínio
 * dedicado `console.autostand.com.br`. Em qualquer outro host
 * (autostand.com.br, subdomínio de tenant, custom domain) todas as
 * rotas /superadmin/* devolvem 404.
 *
 * Para ligar: apontar `console.autostand.com.br` para a
 * plataforma na AWS (CloudFront) e adicionar `console.autostand.com.br` em PLATFORM_HOSTS.
 */
export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireConsoleHost();
  return <>{children}</>;
}
