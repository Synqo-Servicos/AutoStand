import Image from "next/image";
import Link from "next/link";
import { Calendar, Gauge, Car, ShieldCheck, Star, Fuel, Settings } from "lucide-react";
import { formatBRL } from "@/lib/money";
import { FUEL_LABELS, TRANSMISSION_LABELS } from "@/lib/constants";
import type { Fuel as FuelType, Transmission } from "@/lib/constants";
import type { MarketplaceVehicle } from "@/lib/marketplace";
import { cn } from "@/lib/cn";

/**
 * Card de veículo no marketplace — abre o detalhe em /comprar/[id].
 * Novo design (SPEC Onda 3): logo da loja, chips de feature
 * (combustível/câmbio), elevação no hover e badge no canto da foto.
 */
export function MarketplaceVehicleCard({ vehicle }: { vehicle: MarketplaceVehicle }) {
  const anos =
    vehicle.year_manufacture && vehicle.year_manufacture !== vehicle.year
      ? `${vehicle.year_manufacture}/${vehicle.year}`
      : String(vehicle.year);

  const fuelLabel = FUEL_LABELS[vehicle.fuel as FuelType] ?? vehicle.fuel;
  const transLabel = TRANSMISSION_LABELS[vehicle.transmission as Transmission] ?? vehicle.transmission;

  const cornerBadge = vehicle.armored
    ? { label: "Blindado", icon: ShieldCheck }
    : vehicle.single_owner
    ? { label: "Único dono", icon: Star }
    : null;

  return (
    <Link
      href={`/comprar/${vehicle.id}`}
      className={cn(
        "group flex flex-col overflow-hidden bg-white",
        "rounded-xl border border-n200 shadow-xs",
        "transition-[box-shadow,border-color,transform] duration-150 ease-out",
        "hover:shadow-md hover:border-transparent hover:-translate-y-0.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-2",
      )}
    >
      {/* Foto + corner badge */}
      <div className="relative aspect-[4/3] overflow-hidden bg-n100">
        {vehicle.primary_photo_url ? (
          <Image
            src={vehicle.primary_photo_url}
            alt={`${vehicle.brand} ${vehicle.model}`}
            fill
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-n300">
            <Car className="h-14 w-14" />
          </div>
        )}

        {cornerBadge && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-ink/85 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
            <cornerBadge.icon className="h-3 w-3" />
            {cornerBadge.label}
          </span>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <header className="min-w-0">
          <p className="text-eyebrow uppercase text-n500">{vehicle.brand}</p>
          <h3 className="mt-1 font-display text-h3 leading-tight text-ink truncate">
            {vehicle.model}
          </h3>
          {vehicle.version && (
            <p className="mt-0.5 text-body-s text-n600 truncate">{vehicle.version}</p>
          )}
        </header>

        {/* Chips de feature: ano · km · combustível · câmbio */}
        <ul className="flex flex-wrap gap-1.5">
          <Chip icon={Calendar}>{anos}</Chip>
          <Chip icon={Gauge}>{vehicle.km.toLocaleString("pt-BR")} km</Chip>
          <Chip icon={Fuel}>{fuelLabel}</Chip>
          <Chip icon={Settings}>{transLabel}</Chip>
        </ul>

        {/* Preço + loja (com logo) */}
        <footer className="mt-auto flex items-end justify-between gap-3 pt-3 border-t border-n100">
          <div className="min-w-0">
            <p className="text-eyebrow uppercase text-n500">Preço</p>
            <p className="mt-0.5 font-display text-h3 font-semibold text-ink">
              {formatBRL(vehicle.sale_price)}
            </p>
          </div>
          <LojaTag loja={vehicle.loja} />
        </footer>
      </div>
    </Link>
  );
}

function Chip({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <li className="inline-flex items-center gap-1 rounded-full bg-n100 px-2 py-0.5 text-[12px] text-n700">
      <Icon className="h-3 w-3 text-n500" />
      {children}
    </li>
  );
}

function LojaTag({ loja }: { loja: MarketplaceVehicle["loja"] }) {
  return (
    <span className="flex items-center gap-2 min-w-0 max-w-[55%]" title={loja.name}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-n100 ring-1 ring-n200">
        {loja.logo_url ? (
          <Image src={loja.logo_url} alt={loja.name} width={32} height={32} className="h-full w-full object-contain" />
        ) : (
          <span className="text-[10px] font-medium text-n600">
            {loja.name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-body-s text-ink">{loja.name}</span>
        {loja.city && <span className="block truncate text-[11px] text-n500">{loja.city}</span>}
      </span>
    </span>
  );
}
