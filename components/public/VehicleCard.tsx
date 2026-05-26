import Image from "next/image";
import Link from "next/link";
import { Gauge, Calendar, Fuel, Settings } from "lucide-react";
import { formatBRL } from "@/lib/money";
import { FUEL_LABELS, TRANSMISSION_LABELS } from "@/lib/constants";
import type { LayoutConfig } from "@/lib/layout";
import type { Vehicle } from "@/types/vehicle";

type CardStyle = LayoutConfig["cardStyle"];

/** Classes do contêiner por estilo (estilos "info abaixo da imagem"). */
const STANDARD: Record<Exclude<CardStyle, "overlay">, { card: string; aspect: string; pad: string }> = {
  elevated: {
    card: "bg-white rounded-2xl border border-n100 shadow-sm hover:shadow-lg",
    aspect: "aspect-[4/3]",
    pad: "p-4",
  },
  bordered: {
    card: "bg-white rounded-2xl border-2 border-n200 hover:border-[var(--brand-accent)]",
    aspect: "aspect-[4/3]",
    pad: "p-4",
  },
  minimal: {
    card: "bg-transparent",
    aspect: "aspect-[4/3] rounded-xl",
    pad: "pt-3",
  },
  compact: {
    card: "bg-white rounded-xl border border-n100 hover:shadow-md",
    aspect: "aspect-[3/2]",
    pad: "p-3",
  },
};

const PLACEHOLDER = (
  <div className="absolute inset-0 flex items-center justify-center text-n300">
    <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1}
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  </div>
);

export function VehicleCard({
  vehicle,
  whatsapp,
  cardStyle = "elevated",
}: {
  vehicle: Vehicle;
  whatsapp?: string | null;
  cardStyle?: CardStyle;
}) {
  const msg = encodeURIComponent(
    `Olá! Tenho interesse no ${vehicle.brand} ${vehicle.model} ${vehicle.year} anunciado no site.`,
  );
  const ctaHref = whatsapp ? `https://wa.me/${whatsapp}?text=${msg}` : `/veiculos/${vehicle.id}`;
  const ctaProps = whatsapp ? { target: "_blank", rel: "noopener noreferrer" } : {};
  const fuel = FUEL_LABELS[vehicle.fuel as keyof typeof FUEL_LABELS] ?? vehicle.fuel;
  const transmission =
    TRANSMISSION_LABELS[vehicle.transmission as keyof typeof TRANSMISSION_LABELS] ??
    vehicle.transmission;
  const detailHref = `/veiculos/${vehicle.id}`;

  // --- Variante overlay: dados sobre a foto ---
  if (cardStyle === "overlay") {
    return (
      <div className="group relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-2xl bg-n900">
        {vehicle.primary_photo_url ? (
          <Image
            src={vehicle.primary_photo_url}
            alt={`${vehicle.brand} ${vehicle.model}`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          PLACEHOLDER
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        <span className="absolute left-3 top-3 rounded bg-[var(--brand-accent)] px-2 py-1 text-xs font-bold text-white">
          {vehicle.year}
        </span>
        <Link href={detailHref} className="absolute inset-0" aria-label={`${vehicle.brand} ${vehicle.model}`} />

        <div className="relative p-4 text-white">
          <p className="text-xs font-medium uppercase tracking-wide text-white/70">{vehicle.brand}</p>
          <h3 className="text-lg font-semibold leading-snug">{vehicle.model}</h3>
          <div className="mt-1 flex gap-3 text-xs text-white/80">
            <span className="flex items-center gap-1">
              <Gauge className="h-3.5 w-3.5" />
              {vehicle.km.toLocaleString("pt-BR")} km
            </span>
            <span className="flex items-center gap-1">
              <Fuel className="h-3.5 w-3.5" />
              {fuel}
            </span>
          </div>
          <p className="mt-2 text-xl font-bold">{formatBRL(vehicle.sale_price)}</p>
          <a
            href={ctaHref}
            {...ctaProps}
            className="relative mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-accent)] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-accent-d)]"
          >
            Tenho interesse
          </a>
        </div>
      </div>
    );
  }

  // --- Variantes "info abaixo da imagem" ---
  const s = STANDARD[cardStyle];
  const compact = cardStyle === "compact";

  return (
    <div
      className={`${s.card} group flex flex-col overflow-hidden transition-all duration-200`}
    >
      <Link
        href={detailHref}
        className={`relative block ${s.aspect} overflow-hidden bg-n100`}
      >
        {vehicle.primary_photo_url ? (
          <Image
            src={vehicle.primary_photo_url}
            alt={`${vehicle.brand} ${vehicle.model}`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          PLACEHOLDER
        )}
        <div className="absolute left-3 top-3">
          <span className="rounded bg-[var(--brand-accent)] px-2 py-1 text-xs font-bold text-white">
            {vehicle.year}
          </span>
        </div>
      </Link>

      <div className={`flex flex-1 flex-col ${s.pad}`}>
        <Link href={detailHref} className="group/link">
          <p className="text-xs font-medium uppercase tracking-wide text-n400">
            {vehicle.brand}
          </p>
          <h3 className="mt-0.5 font-semibold leading-snug text-n900 transition-colors group-hover/link:text-[var(--brand-accent)]">
            {vehicle.model}
          </h3>
        </Link>

        {!compact && (
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-n500">
            <div className="flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 text-n400" />
              {vehicle.km.toLocaleString("pt-BR")} km
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-n400" />
              {vehicle.year}
            </div>
            <div className="flex items-center gap-1.5">
              <Fuel className="h-3.5 w-3.5 text-n400" />
              {fuel}
            </div>
            <div className="flex items-center gap-1.5">
              <Settings className="h-3.5 w-3.5 text-n400" />
              {transmission}
            </div>
          </div>
        )}
        {compact && (
          <div className="mt-2 flex gap-3 text-xs text-n500">
            <span className="flex items-center gap-1">
              <Gauge className="h-3.5 w-3.5 text-n400" />
              {vehicle.km.toLocaleString("pt-BR")} km
            </span>
            <span className="flex items-center gap-1">
              <Fuel className="h-3.5 w-3.5 text-n400" />
              {fuel}
            </span>
          </div>
        )}

        <div className="mt-auto pt-4">
          <p className={`font-bold text-n900 ${compact ? "text-lg" : "text-xl"}`}>
            {formatBRL(vehicle.sale_price)}
          </p>
          <a
            href={ctaHref}
            {...ctaProps}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-primary-l)]"
          >
            Tenho interesse
          </a>
        </div>
      </div>
    </div>
  );
}
