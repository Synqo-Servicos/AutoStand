import { notFound } from "next/navigation";
import { getVehicleWithPhotos } from "@/lib/db";
import { VehicleForm } from "@/components/admin/VehicleForm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function EditVeiculoPage({ params }: Params) {
  const { id } = await params;
  const vehicle = getVehicleWithPhotos(Number(id));
  if (!vehicle) notFound();

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{vehicle.brand} {vehicle.model}</h1>
        <p className="text-sm text-slate-500 mt-1">{vehicle.year} · {vehicle.km.toLocaleString("pt-BR")} km</p>
      </div>
      <VehicleForm vehicle={vehicle} />
    </div>
  );
}
