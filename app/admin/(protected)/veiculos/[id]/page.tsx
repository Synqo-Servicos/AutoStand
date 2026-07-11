import { notFound } from "next/navigation";
import { getDirectExpensesByVehicle, getDocumentsByVehicle, getVehicleWithPhotos } from "@/lib/db";
import { getAdminTenant } from "@/lib/tenant";
import { capabilitiesFor } from "@/lib/plans";
import { VehicleForm } from "@/components/admin/VehicleForm";
import { PostInstagramButton } from "@/components/admin/PostInstagramButton";
import { VehicleDocumentsManager } from "@/components/admin/VehicleDocumentsManager";
import { DirectExpensesCard } from "@/components/admin/DirectExpensesCard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function EditVeiculoPage({ params }: Params) {
  const { id } = await params;
  const tenant = await getAdminTenant();
  const vehicleId = Number(id);
  const [vehicle, documents, expenses] = await Promise.all([
    getVehicleWithPhotos(tenant.id, vehicleId),
    getDocumentsByVehicle(tenant.id, vehicleId),
    getDirectExpensesByVehicle(tenant.id, vehicleId),
  ]);
  if (!vehicle) notFound();

  return (
    <div className="p-4 sm:p-8 max-w-4xl space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-h2 font-semibold text-ink">{vehicle.brand} {vehicle.model}</h1>
          <p className="text-sm text-n600 mt-1">{vehicle.year} · {vehicle.km.toLocaleString("pt-BR")} km</p>
        </div>
        <PostInstagramButton
          vehicleId={vehicle.id}
          canUse={capabilitiesFor(tenant.plan).instagramPost}
          hasPhoto={!!vehicle.primary_photo_url}
        />
      </div>
      <VehicleForm vehicle={vehicle} />
      <DirectExpensesCard
        vehicleId={vehicle.id}
        costPrice={vehicle.cost_price}
        salePrice={vehicle.sale_price}
        vehicleStatus={vehicle.status}
        initialExpenses={expenses}
      />
      <VehicleDocumentsManager vehicleId={vehicle.id} initialDocuments={documents} />
    </div>
  );
}
