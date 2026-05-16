import { notFound } from "next/navigation";
import { getPartnerById, getTenantsReferredBy } from "@/lib/db";
import { PartnerForm } from "@/components/superadmin/PartnerForm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function EditParceiroPage({ params }: Params) {
  const { id } = await params;
  const partner = await getPartnerById(Number(id));
  if (!partner) notFound();

  const referred = await getTenantsReferredBy(partner.id);

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">{partner.name}</h1>
        <p className="text-sm text-n600">Editar o parceiro e ver a atribuição.</p>
      </div>

      <PartnerForm partner={partner} />

      {/* Atribuição */}
      <div className="mt-8 bg-white rounded-xl border border-n200/70 p-6">
        <h2 className="text-sm font-semibold text-ink">Atribuição</h2>
        <p className="text-xs text-n400 mt-0.5">
          {partner.signup_count} cadastro(s) pelo link deste parceiro.
        </p>
        {referred.length > 0 ? (
          <ul className="mt-4 divide-y divide-n100">
            {referred.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink">{t.name}</span>
                <span className="text-xs text-n400">/{t.slug}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-n400">Nenhuma concessionária atribuída ainda.</p>
        )}
      </div>
    </div>
  );
}
