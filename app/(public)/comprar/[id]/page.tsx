import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Calendar, Gauge, Fuel, Settings, Palette, DoorOpen, Car, ShieldCheck,
  UserCheck, MapPin, Store, MessageCircle,
} from "lucide-react";
import { requirePlatformHost } from "@/lib/tenant";
import { getMarketplaceVehicle } from "@/lib/marketplace";
import { recordView } from "@/lib/demand";
import { formatBRL } from "@/lib/money";
import {
  FUEL_LABELS, TRANSMISSION_LABELS, BODY_TYPE_LABELS, CONDITION_LABELS,
} from "@/lib/constants";
import type { Fuel as FuelType, Transmission, BodyType, Condition } from "@/lib/constants";
import { MarketplaceLeadForm } from "@/components/marketplace/MarketplaceLeadForm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const v = await getMarketplaceVehicle(Number(id));
  if (!v) return { title: "Veículo não encontrado — AutoStand" };
  return {
    title: `${v.brand} ${v.model} ${v.year} — AutoStand`,
    description: `${v.brand} ${v.model}${v.version ? ` ${v.version}` : ""} à venda na ${v.loja.name}.`,
  };
}

export default async function ComprarDetalhePage({ params }: Params) {
  await requirePlatformHost();
  const { id } = await params;
  const v = await getMarketplaceVehicle(Number(id));
  if (!v) notFound();

  await recordView({
    tenantId: null,
    vehicleId: v.id,
    brand: v.brand,
    model: v.model,
    bodyType: v.body_type,
    price: v.sale_price,
  });

  const anos =
    v.year_manufacture && v.year_manufacture !== v.year
      ? `${v.year_manufacture}/${v.year}`
      : String(v.year);
  const label = `${v.brand} ${v.model}${v.version ? ` ${v.version}` : ""} ${v.year}`;
  const photos = v.photos.length > 0 ? v.photos : v.primary_photo_url ? [v.primary_photo_url] : [];
  const mainPhoto = v.primary_photo_url ?? photos[0] ?? null;

  const whatsappDigits = v.loja.whatsapp_number?.replace(/\D/g, "") ?? "";
  const whatsappHref = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
        `Olá! Vi o ${label} no marketplace AutoStand e tenho interesse.`,
      )}`
    : null;

  const specs = [
    { icon: Calendar, label: "Ano", value: anos },
    { icon: Gauge, label: "Quilometragem", value: `${v.km.toLocaleString("pt-BR")} km` },
    { icon: Settings, label: "Câmbio", value: TRANSMISSION_LABELS[v.transmission as Transmission] ?? v.transmission },
    { icon: Fuel, label: "Combustível", value: FUEL_LABELS[v.fuel as FuelType] ?? v.fuel },
    { icon: Palette, label: "Cor", value: v.color },
    { icon: DoorOpen, label: "Portas", value: `${v.doors}` },
    ...(v.body_type ? [{ icon: Car, label: "Carroceria", value: BODY_TYPE_LABELS[v.body_type as BodyType] ?? v.body_type }] : []),
    { icon: ShieldCheck, label: "Condição", value: CONDITION_LABELS[v.condition as Condition] ?? v.condition },
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <Link href="/comprar" className="text-sm text-n500 hover:text-ink transition-colors">
        ← Voltar para a busca
      </Link>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* Fotos + dados */}
        <div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-n200 bg-n100">
            {mainPhoto ? (
              <Image src={mainPhoto} alt={label} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 60vw" priority />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-n300">
                <Car className="h-20 w-20" />
              </div>
            )}
          </div>
          {photos.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {photos.slice(0, 8).map((url) => (
                <div key={url} className="relative aspect-[4/3] overflow-hidden rounded-lg border border-n200 bg-n100">
                  <Image src={url} alt={label} fill className="object-cover" sizes="120px" />
                </div>
              ))}
            </div>
          )}

          {/* Ficha técnica */}
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-ink">Ficha técnica</h2>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {specs.map(({ icon: Icon, label: l, value }) => (
                <div key={l} className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0 text-n400" />
                  <div>
                    <p className="text-xs text-n500">{l}</p>
                    <p className="text-sm font-medium text-ink">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {(v.single_owner || v.armored || (v.optionals && v.optionals.length > 0)) && (
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-ink">Destaques e opcionais</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {v.single_owner && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink">
                    <UserCheck className="h-3.5 w-3.5" /> Único dono
                  </span>
                )}
                {v.armored && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink">
                    <ShieldCheck className="h-3.5 w-3.5" /> Blindado
                  </span>
                )}
                {v.optionals?.map((opt) => (
                  <span key={opt} className="rounded-full bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink">
                    {opt}
                  </span>
                ))}
              </div>
            </div>
          )}

          {v.description && (
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-ink">Descrição</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-n600">
                {v.description}
              </p>
            </div>
          )}
        </div>

        {/* Coluna de contato */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-n200 bg-white p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-n400">{v.brand}</p>
            <h1 className="mt-0.5 text-2xl font-bold text-ink">{v.model}</h1>
            {v.version && <p className="text-sm text-n500">{v.version}</p>}
            <p className="mt-4 text-3xl font-bold text-ink">{formatBRL(v.sale_price)}</p>

            {/* Loja */}
            <Link
              href={`/loja/${v.loja.slug}`}
              className="mt-5 flex items-center gap-3 rounded-xl border border-n200 p-3 transition-colors hover:bg-n50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink/5 text-ink">
                <Store className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">{v.loja.name}</span>
                <span className="flex items-center gap-1 text-xs text-n500">
                  <MapPin className="h-3 w-3" />
                  {v.loja.city ?? "Ver loja"}
                </span>
              </span>
            </Link>

            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-n200 px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-n50"
              >
                <MessageCircle className="h-4 w-4" />
                Falar no WhatsApp
              </a>
            )}

            <div className="mt-5 border-t border-n100 pt-5">
              <p className="mb-3 text-sm font-semibold text-ink">Tem interesse?</p>
              <MarketplaceLeadForm vehicleId={v.id} vehicleLabel={label} lojaName={v.loja.name} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
