import { Suspense } from "react";
import { listVehicles } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { VehicleCard } from "@/components/public/VehicleCard";
import { VehicleFilters } from "@/components/public/VehicleFilters";

/** Vitrine pública de uma concessionária (renderizada em hosts de tenant). */
export async function Storefront({ sp }: { sp: Record<string, string> }) {
  const tenant = await requireTenant();

  const vehicles = await listVehicles(tenant.id, {
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
  });

  const waHref = tenant.whatsapp_number ? `https://wa.me/${tenant.whatsapp_number}` : "#contato";
  const heroTitle = tenant.hero_title ?? "Seminovos com procedência";
  const heroSubtitle =
    tenant.hero_subtitle ??
    "Carros revisados, documentação em dia e financiamento facilitado. Encontre o carro certo para você.";

  return (
    <>
      {/* Hero */}
      <section className="relative bg-[var(--brand-primary)] text-white py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand-primary)] via-[var(--brand-primary)] to-[var(--brand-primary-d)]" />
        <div className="relative max-w-7xl mx-auto">
          {tenant.city && (
            <p className="text-[var(--brand-accent)] font-semibold text-sm uppercase tracking-widest mb-3">
              {tenant.city}
            </p>
          )}
          <h1 className="font-heading text-4xl md:text-6xl font-bold leading-tight mb-6 uppercase">
            {heroTitle}
          </h1>
          <p className="text-slate-300 text-lg max-w-xl mb-8">{heroSubtitle}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="#estoque"
              className="inline-flex items-center justify-center gap-2 bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-d)] text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
            >
              Ver estoque
            </a>
            {tenant.whatsapp_number && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 border border-white/20 hover:border-white/40 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
              >
                Falar no WhatsApp
              </a>
            )}
          </div>

          <div className="grid grid-cols-3 gap-8 mt-16 pt-8 border-t border-white/10 max-w-md">
            {[["100%", "Revisados"], ["0", "Surpresas"], ["Direto", "Comigo"]].map(([val, desc]) => (
              <div key={desc}>
                <p className="text-2xl font-bold text-white">{val}</p>
                <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Estoque */}
      <section id="estoque" className="py-16 px-4 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <p className="text-xs font-semibold text-[var(--brand-accent)] uppercase tracking-widest mb-2">Estoque</p>
            <h2 className="text-2xl font-bold text-slate-900">Veículos disponíveis</h2>
          </div>

          <Suspense>
            <VehicleFilters />
          </Suspense>

          <div className="mt-6">
            {vehicles.length === 0 ? (
              <div className="text-center py-24 text-slate-400">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {vehicles.map((v) => (
                  <VehicleCard key={v.id} vehicle={v} whatsapp={tenant.whatsapp_number} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Sobre */}
      <section id="sobre" className="py-16 px-4 bg-[var(--brand-primary)] text-white">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs font-semibold text-[var(--brand-accent)] uppercase tracking-widest mb-2">Sobre</p>
          <h2 className="font-heading text-3xl font-bold mb-10">POR QUE {tenant.name.toUpperCase()}?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              ["✓", "Procedência garantida", "Cada veículo com histórico e revisão documentada."],
              ["✓", "Sem taxa de intermediário", "Você negocia direto, sem surpresas no final."],
              ["✓", "Financiamento facilitado", "Condições especiais, mesmo para negativados."],
              ["✓", "Atendimento humano", `${tenant.business_hours ?? "Atendimento"}, sempre disponível.`],
            ].map(([icon, title, desc]) => (
              <div key={title} className="bg-white/5 rounded-xl p-5 border border-white/10">
                <div className="w-8 h-8 bg-[var(--brand-accent)] rounded-lg flex items-center justify-center text-white font-bold text-sm mb-3">
                  {icon}
                </div>
                <h3 className="font-semibold text-white text-sm mb-1">{title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contato */}
      <section id="contato" className="py-16 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-semibold text-[var(--brand-accent)] uppercase tracking-widest mb-2">Contato</p>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Pronto para comprar?</h2>
          <p className="text-slate-500 mb-8">Entre em contato agora e encontre o carro ideal.</p>
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
                className="inline-flex items-center justify-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
              >
                Instagram
              </a>
            )}
          </div>
          {tenant.business_hours && (
            <p className="text-xs text-slate-400 mt-6">{tenant.business_hours}</p>
          )}
        </div>
      </section>
    </>
  );
}
