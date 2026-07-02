import { notFound } from "next/navigation";
import { Gauge, Calendar, Fuel, Settings, MapPin } from "lucide-react";
import { getVehicleWithPhotos } from "@/lib/db";
import { recordView } from "@/lib/demand";
import { getCurrentTenant } from "@/lib/tenant";
import { PartnerBanks } from "@/components/public/PartnerBanks";
import { PhotoGallery } from "@/components/public/PhotoGallery";
import { LeadForm } from "@/components/public/LeadForm";
import { formatBRL } from "@/lib/money";
import { waHref as toWaHref } from "@/lib/whatsapp";
import { FUEL_LABELS, TRANSMISSION_LABELS, STATUS_LABELS } from "@/lib/constants";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  if (!tenant || tenant.status !== "active") return { title: "Loja" };
  const vehicle = await getVehicleWithPhotos(tenant.id, Number(id));
  if (!vehicle) return { title: "Veículo não encontrado" };
  return {
    title: `${vehicle.brand} ${vehicle.model} ${vehicle.year} — ${tenant.name}`,
    description: `${vehicle.brand} ${vehicle.model} ${vehicle.year}, ${vehicle.km.toLocaleString("pt-BR")} km, ${formatBRL(vehicle.sale_price)}`,
  };
}

export default async function VehiclePage({ params }: Params) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  // Loja não-ativa: o layout renderiza a página "indisponível".
  if (!tenant || tenant.status !== "active") return null;
  const vehicle = await getVehicleWithPhotos(tenant.id, Number(id));
  if (!vehicle) notFound();

  await recordView({
    tenantId: tenant.id,
    vehicleId: vehicle.id,
    brand: vehicle.brand,
    model: vehicle.model,
    bodyType: vehicle.body_type,
    price: vehicle.sale_price,
  });

  const label = `${vehicle.brand} ${vehicle.model} ${vehicle.year}`;
  const waHref = toWaHref(
    tenant.whatsapp_number,
    `Olá! Tenho interesse no ${label} anunciado no site. Pode me passar mais detalhes?`,
  );

  const specs = [
    { icon: Calendar, label: "Ano", value: String(vehicle.year) },
    { icon: Gauge, label: "Quilometragem", value: `${vehicle.km.toLocaleString("pt-BR")} km` },
    { icon: Fuel, label: "Combustível", value: FUEL_LABELS[vehicle.fuel as keyof typeof FUEL_LABELS] ?? vehicle.fuel },
    { icon: Settings, label: "Câmbio", value: TRANSMISSION_LABELS[vehicle.transmission as keyof typeof TRANSMISSION_LABELS] ?? vehicle.transmission },
    { icon: MapPin, label: "Cor", value: vehicle.color },
    { icon: Calendar, label: "Portas", value: `${vehicle.doors} portas` },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Gallery */}
        <div>
          <PhotoGallery photos={vehicle.photos} alt={`${vehicle.brand} ${vehicle.model}`} />
        </div>

        {/* Details */}
        <div>
          <p className="text-xs font-semibold text-[var(--brand-accent)] uppercase tracking-widest mb-1">
            {vehicle.brand}
          </p>
          <h1 className="text-3xl font-bold text-n900 leading-tight">{vehicle.model}</h1>
          <p className="text-n500 text-sm mt-1">
            {vehicle.year} · {vehicle.km.toLocaleString("pt-BR")} km
          </p>

          <div className="mt-4">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                vehicle.status === "disponivel"
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  : vehicle.status === "reservado"
                    ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                    : "bg-n100 text-n500 ring-1 ring-n200"
              }`}
            >
              {STATUS_LABELS[vehicle.status as keyof typeof STATUS_LABELS] ?? vehicle.status}
            </span>
          </div>

          <p className="text-4xl font-bold text-n900 mt-6">{formatBRL(vehicle.sale_price)}</p>

          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center w-full gap-2 bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-d)] text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
            >
              Falar no WhatsApp
            </a>
          )}

          <PartnerBanks slugs={tenant.partner_banks} variant="compact" className="mt-3" />

          <LeadForm vehicleId={vehicle.id} vehicleLabel={label} />

          {/* Specs */}
          <div className="mt-8 border border-n100 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-n50 border-b border-n100">
              <p className="text-xs font-semibold text-n500 uppercase tracking-wide">Especificações</p>
            </div>
            <div className="divide-y divide-n100">
              {specs.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-n500">
                    <Icon className="w-4 h-4 text-n400" />
                    {label}
                  </div>
                  <span className="text-sm font-medium text-n900">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {vehicle.description && (
            <div className="mt-6">
              <p className="text-xs font-semibold text-n500 uppercase tracking-wide mb-2">Descrição</p>
              <p className="text-sm text-n600 leading-relaxed whitespace-pre-line">{vehicle.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
