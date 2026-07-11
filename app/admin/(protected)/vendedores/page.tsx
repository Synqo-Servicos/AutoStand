import { getAdminTenant } from "@/lib/tenant";
import { listSellers } from "@/lib/db";
import { VendedoresList } from "@/components/admin/VendedoresList";

export const dynamic = "force-dynamic";

export default async function VendedoresPage() {
  const tenant = await getAdminTenant();
  const sellers = await listSellers(tenant.id);
  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <header className="mb-6">
        <h1 className="font-display text-h2 font-semibold text-ink">Vendedores</h1>
        <p className="text-sm text-n600 mt-1">
          Equipe de vendas. A comissão configurada aqui é aplicada automaticamente
          em cada venda registrada.
        </p>
      </header>
      <VendedoresList initialSellers={sellers} />
    </div>
  );
}
