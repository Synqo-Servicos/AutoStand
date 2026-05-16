import Image from "next/image";
import Link from "next/link";
import { Gauge, Calendar, Fuel, Settings } from "lucide-react";
import { formatBRL } from "@/lib/money";
import { FUEL_LABELS, TRANSMISSION_LABELS } from "@/lib/constants";
import type { Vehicle } from "@/types/vehicle";

export function VehicleCard({
  vehicle,
  whatsapp,
}: {
  vehicle: Vehicle;
  whatsapp?: string | null;
}) {
  const msg = encodeURIComponent(
    `Olá! Tenho interesse no ${vehicle.brand} ${vehicle.model} ${vehicle.year} anunciado no site.`,
  );
  const ctaHref = whatsapp ? `https://wa.me/${whatsapp}?text=${msg}` : `/veiculos/${vehicle.id}`;

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg border border-slate-100 transition-all duration-200 group flex flex-col">
      <Link href={`/veiculos/${vehicle.id}`} className="block relative aspect-[4/3] overflow-hidden bg-slate-100">
        {vehicle.primary_photo_url ? (
          <Image
            src={vehicle.primary_photo_url}
            alt={`${vehicle.brand} ${vehicle.model}`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-300">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className="bg-[var(--brand-accent)] text-white text-xs font-bold px-2 py-1 rounded">
            {vehicle.year}
          </span>
        </div>
      </Link>

      <div className="flex flex-col flex-1 p-4">
        <Link href={`/veiculos/${vehicle.id}`} className="group/link">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{vehicle.brand}</p>
          <h3 className="font-semibold text-slate-900 text-base leading-snug group-hover/link:text-[var(--brand-accent)] transition-colors mt-0.5">
            {vehicle.model}
          </h3>
        </Link>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-slate-400" />
            {vehicle.km.toLocaleString("pt-BR")} km
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            {vehicle.year}
          </div>
          <div className="flex items-center gap-1.5">
            <Fuel className="w-3.5 h-3.5 text-slate-400" />
            {FUEL_LABELS[vehicle.fuel as keyof typeof FUEL_LABELS] ?? vehicle.fuel}
          </div>
          <div className="flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            {TRANSMISSION_LABELS[vehicle.transmission as keyof typeof TRANSMISSION_LABELS] ?? vehicle.transmission}
          </div>
        </div>

        <div className="mt-auto pt-4">
          <p className="text-xl font-bold text-slate-900">{formatBRL(vehicle.sale_price)}</p>
          <a
            href={ctaHref}
            {...(whatsapp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="mt-2 flex items-center justify-center w-full gap-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-l)] text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
          >
            Tenho interesse
          </a>
        </div>
      </div>
    </div>
  );
}
