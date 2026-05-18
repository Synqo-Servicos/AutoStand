import { notFound } from "next/navigation";
import { getVehicleWithPhotos } from "@/lib/db";
import { getAdminTenant } from "@/lib/tenant";
import { capabilitiesFor } from "@/lib/plans";
import { VehicleForm } from "@/components/admin/VehicleForm";
import { PostInstagramButton } from "@/components/admin/PostInstagramButton";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function EditVeiculoPage({ params }: Params) {
  const { id } = await params;
  const tenant = await getAdminTenant();
  const vehicle = await getVehicleWithPhotos(tenant.id, Number(id));
  if (!vehicle) notFound();

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{vehicle.brand} {vehicle.model}</h1>
          <p className="text-sm text-n600 mt-1">{vehicle.year} · {vehicle.km.toLocaleString("pt-BR")} km</p>
        </div>
        <PostInstagramButton
          vehicleId={vehicle.id}
          canUse={capabilitiesFor(tenant.plan).instagramPost}
          hasPhoto={!!vehicle.primary_photo_url}
        />
      </div>
      <VehicleForm vehicle={vehicle} />
    </div>
  );
}
