import { getAdminTenant } from "@/lib/tenant";
import { listAboutItems, listVehicles } from "@/lib/db";
import { capabilitiesFor, getPlan } from "@/lib/plans";
import { PersonalizarEditor } from "@/components/admin/PersonalizarEditor";

export const dynamic = "force-dynamic";

export default async function PersonalizarPage() {
  const tenant = await getAdminTenant();
  const [vehicles, aboutItems] = await Promise.all([
    listVehicles(tenant.id, { status: "disponivel" }),
    listAboutItems(tenant.id),
  ]);

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="font-display text-h2 font-semibold text-ink">Personalizar</h1>
        <p className="mt-1 text-body-s text-n600">
          A aparência do site público da {tenant.name} — alterações entram no ar ao salvar.
        </p>
      </header>
      <PersonalizarEditor
        tenant={tenant}
        sampleVehicles={vehicles.slice(0, 4)}
        canEditLayout={capabilitiesFor(tenant.plan).layoutConfig}
        planName={getPlan(tenant.plan).name}
        initialAboutItems={aboutItems}
      />
    </div>
  );
}
