import { notFound } from "next/navigation";
import { getTenantById } from "@/lib/db";
import { TenantForm } from "@/components/superadmin/TenantForm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function EditTenantPage({ params }: Params) {
  const { id } = await params;
  const tenant = await getTenantById(Number(id));
  if (!tenant) notFound();

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8 flex items-center gap-3">
        <span
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
          style={{ backgroundColor: tenant.primary_color }}
        >
          {tenant.name.slice(0, 2).toUpperCase()}
        </span>
        <div>
          <h1 className="text-2xl font-bold text-ink">{tenant.name}</h1>
          <p className="text-sm text-n600">Editar dados e identidade visual.</p>
        </div>
      </div>
      <TenantForm tenant={tenant} />
    </div>
  );
}
