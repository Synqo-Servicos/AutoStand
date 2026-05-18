import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Store, MapPin, ExternalLink, MessageCircle, Clock } from "lucide-react";
import { requirePlatformHost } from "@/lib/tenant";
import { getMarketplaceTenantBySlug } from "@/lib/marketplace";
import { MarketplaceVehicleCard } from "@/components/marketplace/MarketplaceVehicleCard";

export const dynamic = "force-dynamic";

const PLATFORM_DOMAIN = (process.env.PLATFORM_DOMAIN ?? "autostand.com.br").trim();

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const loja = await getMarketplaceTenantBySlug(slug);
  if (!loja) return { title: "Loja não encontrada — AutoStand" };
  return {
    title: `${loja.name} — AutoStand`,
    description: `Veículos seminovos da ${loja.name}${loja.city ? ` em ${loja.city}` : ""}.`,
  };
}

export default async function LojaPage({ params }: Params) {
  await requirePlatformHost();
  const { slug } = await params;
  const loja = await getMarketplaceTenantBySlug(slug);
  if (!loja) notFound();

  const siteUrl = `https://${loja.custom_domain ?? `${slug}.${PLATFORM_DOMAIN}`}`;
  const whatsappDigits = loja.whatsapp_number?.replace(/\D/g, "") ?? "";

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <Link href="/lojas" className="text-sm text-n500 hover:text-ink transition-colors">
        ← Todas as concessionárias
      </Link>

      {/* Cabeçalho da loja */}
      <header className="mt-5 flex flex-col gap-5 rounded-2xl border border-n200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink/5">
            {loja.logo_url ? (
              <Image src={loja.logo_url} alt={loja.name} width={64} height={64} className="h-full w-full object-contain" />
            ) : (
              <Store className="h-7 w-7 text-ink" />
            )}
          </span>
          <div>
            <h1 className="text-2xl font-bold text-ink">{loja.name}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-n500">
              {loja.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {loja.city}
                </span>
              )}
              {loja.business_hours && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {loja.business_hours}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {whatsappDigits && (
            <a
              href={`https://wa.me/${whatsappDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-n200 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-n50"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          )}
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-signal-dark"
          >
            <ExternalLink className="h-4 w-4" />
            Visitar o site da loja
          </a>
        </div>
      </header>

      {/* Estoque */}
      <h2 className="mt-10 text-lg font-semibold text-ink">
        Estoque{" "}
        <span className="text-sm font-normal text-n500">
          ({loja.vehicles.length} {loja.vehicles.length === 1 ? "veículo" : "veículos"})
        </span>
      </h2>

      {loja.vehicles.length === 0 ? (
        <p className="mt-4 text-sm text-n500">Esta loja não tem veículos disponíveis no momento.</p>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loja.vehicles.map((v) => (
            <MarketplaceVehicleCard key={v.id} vehicle={v} />
          ))}
        </div>
      )}
    </div>
  );
}
