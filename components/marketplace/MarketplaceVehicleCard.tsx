import Image from "next/image";
import Link from "next/link";
import { Calendar, Gauge, MapPin, Car } from "lucide-react";
import { formatBRL } from "@/lib/money";
import type { MarketplaceVehicle } from "@/lib/marketplace";

/** Card de veículo no marketplace — tema da plataforma, leva ao detalhe. */
export function MarketplaceVehicleCard({ vehicle }: { vehicle: MarketplaceVehicle }) {
  const anos =
    vehicle.year_manufacture && vehicle.year_manufacture !== vehicle.year
      ? `${vehicle.year_manufacture}/${vehicle.year}`
      : String(vehicle.year);

  return (
    <Link
      href={`/comprar/${vehicle.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-n200 bg-white transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-n100">
        {vehicle.primary_photo_url ? (
          <Image
            src={vehicle.primary_photo_url}
            alt={`${vehicle.brand} ${vehicle.model}`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-n300">
            <Car className="h-14 w-14" />
          </div>
        )}
        {(vehicle.single_owner || vehicle.armored) && (
          <span className="absolute left-3 top-3 rounded bg-signal px-2 py-1 text-xs font-semibold text-ink">
            {vehicle.armored ? "Blindado" : "Único dono"}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-n400">{vehicle.brand}</p>
        <h3 className="mt-0.5 font-semibold leading-snug text-ink transition-colors group-hover:text-signal">
          {vehicle.model}
        </h3>
        {vehicle.version && (
          <p className="mt-0.5 text-xs text-n500 truncate">{vehicle.version}</p>
        )}

        <div className="mt-2.5 flex gap-3 text-xs text-n500">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-n400" />
            {anos}
          </span>
          <span className="flex items-center gap-1">
            <Gauge className="h-3.5 w-3.5 text-n400" />
            {vehicle.km.toLocaleString("pt-BR")} km
          </span>
        </div>

        <div className="mt-auto pt-3">
          <p className="text-xl font-bold text-ink">{formatBRL(vehicle.sale_price)}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-n500">
            <MapPin className="h-3 w-3 text-n400" />
            {vehicle.loja.name}
            {vehicle.loja.city ? ` · ${vehicle.loja.city}` : ""}
          </p>
        </div>
      </div>
    </Link>
  );
}
