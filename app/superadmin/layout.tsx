import { requirePlatformHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * O console super-admin (login + painel) só existe no host da plataforma
 * (autostand.com.br / vercel preview). Em qualquer subdomínio de tenant,
 * todas as rotas /superadmin/* devolvem 404.
 */
export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePlatformHost();
  return <>{children}</>;
}
