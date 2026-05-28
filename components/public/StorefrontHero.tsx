import type { LayoutConfig } from "@/lib/layout";
import type { TenantRow } from "@/lib/schema";

/**
 * Hero da vitrine — renderiza conforme `layout_config.heroStyle`:
 *  - gradient → degradê da cor da marca (padrão);
 *  - solid    → cor da marca chapada;
 *  - image    → foto de fundo (heroImageUrl) com scrim da cor da marca.
 */
export function StorefrontHero({
  tenant,
  config,
}: {
  tenant: TenantRow;
  config: LayoutConfig;
}) {
  const heroTitle = tenant.hero_title ?? "Seminovos com procedência";
  const heroSubtitle =
    tenant.hero_subtitle ??
    "Carros revisados, documentação em dia e financiamento facilitado. Encontre o carro certo para você.";
  // Eyebrow: slogan editorial tem prioridade; cai pra cidade quando ausente.
  const eyebrow = tenant.slogan?.trim() || tenant.city;
  const waHref = tenant.whatsapp_number ? `https://wa.me/${tenant.whatsapp_number}` : "#contato";

  const useImage = config.heroStyle === "image" && !!config.heroImageUrl;

  return (
    <section
      className="relative bg-[var(--brand-primary)] text-white py-24 px-4 overflow-hidden"
      style={
        useImage
          ? {
              backgroundImage: `url(${config.heroImageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {/* Camada de fundo conforme a variante */}
      {config.heroStyle === "gradient" && (
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand-primary)] via-[var(--brand-primary)] to-[var(--brand-primary-d)]" />
      )}
      {useImage && (
        <div
          className="absolute inset-0"
          style={{ background: "var(--brand-primary)", opacity: 0.78 }}
        />
      )}
      {/* solid: sem camada extra — fica a cor chapada do <section> */}

      <div className="relative max-w-7xl mx-auto">
        {eyebrow && (
          <p className="text-[var(--brand-accent)] font-semibold text-sm uppercase tracking-widest mb-3">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-4xl md:text-6xl font-bold leading-tight mb-6 uppercase">
          {heroTitle}
        </h1>
        <p className="text-n300 text-lg max-w-xl mb-8">{heroSubtitle}</p>
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
              <p className="text-xs text-n400 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
