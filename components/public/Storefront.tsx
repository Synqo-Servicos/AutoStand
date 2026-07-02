import { Suspense } from "react";
import {
  CreditCard,
  Handshake,
  MapPin,
  MessageCircle,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { listAboutItems, listVehicles } from "@/lib/db";
import { recordSearch } from "@/lib/demand";
import { getCurrentTenant } from "@/lib/tenant";
import { resolveLayoutConfig } from "@/lib/layout";
import { iconForSlug } from "@/lib/about-icons";
import { waHref as toWaHref } from "@/lib/whatsapp";
import { StorefrontHero } from "@/components/public/StorefrontHero";
import { VehicleCard } from "@/components/public/VehicleCard";
import { VehicleFilters } from "@/components/public/VehicleFilters";
import { StorefrontFooter } from "@/components/public/StorefrontFooter";
import type { TenantRow } from "@/lib/schema";

/**
 * Vitrine pública de uma concessionária (renderizada em hosts de tenant).
 * Hero, estilo de card e cards por fila vêm de `tenant.layout_config` (Fase 4).
 * Textos editoriais (slogan, about_heading, contact_cta_*, address) e a lista
 * de cards da seção "Sobre" são editáveis pelo tenant_admin.
 */
export async function Storefront({ sp }: { sp: Record<string, string> }) {
  const tenant = await getCurrentTenant();
  // Loja não-ativa: o layout do grupo público renderiza a página "indisponível".
  if (!tenant || tenant.status !== "active") return null;
  const layout = resolveLayoutConfig(tenant.layout_config);

  const [vehicles, aboutItems] = await Promise.all([
    listVehicles(tenant.id, {
      status:       sp.status       ?? "disponivel",
      brand:        sp.brand        || undefined,
      fuel:         sp.fuel         || undefined,
      transmission: sp.transmission || undefined,
      year_min:     sp.year_min  ? Number(sp.year_min)  : undefined,
      year_max:     sp.year_max  ? Number(sp.year_max)  : undefined,
      km_max:       sp.km_max    ? Number(sp.km_max)    : undefined,
      price_min:    sp.price_min ? Number(sp.price_min) : undefined,
      price_max:    sp.price_max ? Number(sp.price_max) : undefined,
      search:       sp.search       || undefined,
    }),
    listAboutItems(tenant.id),
  ]);

  // Registra a busca no site da loja como sinal de demanda (anônimo).
  await recordSearch({
    tenantId: tenant.id,
    brand:        sp.brand        || undefined,
    fuel:         sp.fuel         || undefined,
    transmission: sp.transmission || undefined,
    price:        sp.price_max ? Number(sp.price_max) : undefined,
    yearMin:      sp.year_min  ? Number(sp.year_min)  : undefined,
    searchTerm:   sp.search       || undefined,
  });

  const waHref = toWaHref(tenant.whatsapp_number) ?? "#contato";
  const gridCols = layout.cardsPerRow === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";

  return (
    <>
      <StorefrontHero tenant={tenant} config={layout} />

      {/* Estoque */}
      <section id="estoque" className="py-16 px-4 bg-n50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <p className="text-xs font-semibold text-[var(--brand-accent)] uppercase tracking-widest mb-2">Estoque</p>
            <h2 className="text-2xl font-bold text-n900">Veículos disponíveis</h2>
          </div>

          <Suspense>
            <VehicleFilters />
          </Suspense>

          <div className="mt-6">
            {vehicles.length === 0 ? (
              <div className="text-center py-24 text-n400">
                <p className="text-lg font-medium">Nenhum veículo encontrado</p>
                <p className="text-sm mt-1">Tente ajustar os filtros ou entre em contato</p>
                {tenant.whatsapp_number && (
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block bg-[var(--brand-accent)] text-white text-sm font-medium px-5 py-2.5 rounded-xl"
                  >
                    Falar no WhatsApp
                  </a>
                )}
              </div>
            ) : (
              <div className={`grid grid-cols-1 sm:grid-cols-2 ${gridCols} gap-5`}>
                {vehicles.map((v) => (
                  <VehicleCard
                    key={v.id}
                    vehicle={v}
                    whatsapp={tenant.whatsapp_number}
                    cardStyle={layout.cardStyle}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Sobre */}
      <AboutSection tenant={tenant} items={aboutItems} />

      {/* Contato */}
      <ContactSection tenant={tenant} waHref={waHref} />

      {/* Footer */}
      <StorefrontFooter tenant={tenant} waHref={waHref} />
    </>
  );
}

// ---------- Sobre ----------

interface AboutCard {
  Icon: LucideIcon;
  title: string;
  desc: string;
}

function AboutSection({
  tenant,
  items,
}: {
  tenant: TenantRow;
  items: Awaited<ReturnType<typeof listAboutItems>>;
}) {
  const heading = tenant.about_heading?.trim() || `Por que ${tenant.name}?`;
  const cards: AboutCard[] =
    items.length > 0
      ? items.map((i) => ({ Icon: iconForSlug(i.icon_slug), title: i.title, desc: i.description }))
      : defaultAboutCards(tenant);

  return (
    <section id="sobre" className="py-16 px-4 bg-[var(--brand-primary)] text-white">
      <div className="max-w-7xl mx-auto">
        <p className="text-eyebrow uppercase text-[var(--brand-accent)] mb-3">Sobre</p>
        <h2 className="font-display text-h2 font-semibold mb-10">{heading}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {cards.map(({ Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl bg-white/[0.06] p-5 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.08]"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand-accent)] text-white">
                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </div>
              <h3 className="text-body-s font-semibold text-white">{title}</h3>
              <p className="mt-1 text-body-s leading-relaxed text-white/70">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function defaultAboutCards(tenant: TenantRow): AboutCard[] {
  return [
    {
      Icon: ShieldCheck,
      title: "Procedência garantida",
      desc: "Cada veículo com histórico e revisão documentada.",
    },
    {
      Icon: Handshake,
      title: "Sem taxa de intermediário",
      desc: "Você negocia direto, sem surpresas no final.",
    },
    {
      Icon: CreditCard,
      title: "Financiamento facilitado",
      desc: "Condições especiais, mesmo para negativados.",
    },
    {
      Icon: MessageCircle,
      title: "Atendimento humano",
      desc: `${tenant.business_hours ?? "Atendimento"}, sempre disponível.`,
    },
  ];
}

// ---------- Contato ----------

function ContactSection({ tenant, waHref }: { tenant: TenantRow; waHref: string }) {
  const ctaTitle = tenant.contact_cta_title?.trim() || "Pronto para comprar?";
  const ctaBody =
    tenant.contact_cta_body?.trim() || "Entre em contato agora e encontre o carro ideal.";

  return (
    <section id="contato" className="py-16 px-4 bg-white">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-xs font-semibold text-[var(--brand-accent)] uppercase tracking-widest mb-2">
          Contato
        </p>
        <h2 className="text-2xl font-bold text-n900 mb-3">{ctaTitle}</h2>
        <p className="text-n500 mb-8">{ctaBody}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {tenant.whatsapp_number && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-l)] text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
            >
              WhatsApp
            </a>
          )}
          {tenant.instagram_url && (
            <a
              href={tenant.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 border border-n200 hover:bg-n50 text-n700 font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
            >
              Instagram
            </a>
          )}
        </div>
        {tenant.address && (
          <p className="mt-6 inline-flex items-center justify-center gap-1.5 text-body-s text-n600">
            <MapPin className="h-4 w-4 text-n500" aria-hidden />
            {tenant.address}
          </p>
        )}
        {tenant.business_hours && (
          <p className="text-xs text-n400 mt-3">{tenant.business_hours}</p>
        )}
      </div>
    </section>
  );
}
