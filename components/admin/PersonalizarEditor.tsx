"use client";

import { useState } from "react";
import Image from "next/image";
import { Lock, MapPin } from "lucide-react";
import { BANKS } from "@/lib/banks";
import { StorefrontHero } from "@/components/public/StorefrontHero";
import { VehicleCard } from "@/components/public/VehicleCard";
import { CARD_STYLES, HERO_STYLES, resolveLayoutConfig } from "@/lib/layout";
import type { LayoutConfig } from "@/lib/layout";
import type { TenantAboutItemRow, TenantRow, VehicleRow } from "@/lib/schema";
import type { Vehicle } from "@/types/vehicle";
import { AboutEditor } from "./AboutEditor";

const HERO_LABELS: Record<LayoutConfig["heroStyle"], string> = {
  gradient: "Degradê",
  solid: "Cor sólida",
  image: "Imagem de fundo",
};
const CARD_LABELS: Record<LayoutConfig["cardStyle"], string> = {
  elevated: "Elevado",
  bordered: "Contornado",
  minimal: "Minimalista",
  compact: "Compacto",
  overlay: "Sobre a foto",
};

const MOCK_VEHICLES: Vehicle[] = [
  {
    id: -1, brand: "Honda", model: "Civic", version: "1.5 Turbo EXL",
    year: 2023, year_manufacture: 2022, km: 28000,
    cost_price: 0, sale_price: 11900000, transmission: "automatico", fuel: "flex",
    color: "Prata", doors: 4, body_type: "sedan", condition: "seminovo",
    optionals: null, armored: false, single_owner: false, fipe_code: null, plate: null,
    description: null, status: "disponivel",
    primary_photo_url:
      "https://images.unsplash.com/photo-1606152421802-db97b9c7a11b?auto=format&fit=crop&w=800&q=80",
    created_at: "", updated_at: "",
  },
  {
    id: -2, brand: "Jeep", model: "Compass", version: "2.0 Longitude",
    year: 2022, year_manufacture: 2021, km: 41000,
    cost_price: 0, sale_price: 14500000, transmission: "automatico", fuel: "diesel",
    color: "Branco", doors: 4, body_type: "suv", condition: "seminovo",
    optionals: null, armored: false, single_owner: false, fipe_code: null, plate: null,
    description: null, status: "disponivel",
    primary_photo_url:
      "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80",
    created_at: "", updated_at: "",
  },
];

const cardClass = "rounded-xl border border-n200 bg-white p-5";
const labelClass = "block text-body-s font-medium text-ink";
const inputClass =
  "w-full rounded-lg border border-n200 bg-white px-3 py-2 text-body text-ink " +
  "placeholder-n400 outline-none focus:border-signal focus:ring-2 focus:ring-signal/30";

export function PersonalizarEditor({
  tenant,
  sampleVehicles,
  canEditLayout,
  planName,
  initialAboutItems,
}: {
  tenant: TenantRow;
  sampleVehicles: VehicleRow[];
  canEditLayout: boolean;
  planName: string;
  initialAboutItems: TenantAboutItemRow[];
}) {
  const layout0 = resolveLayoutConfig(tenant.layout_config);

  const [primary, setPrimary] = useState(tenant.primary_color);
  const [accent, setAccent] = useState(tenant.accent_color);
  const [accentDark, setAccentDark] = useState(tenant.accent_dark_color);
  const [slogan, setSlogan] = useState(tenant.slogan ?? "");
  const [heroTitle, setHeroTitle] = useState(tenant.hero_title ?? "");
  const [heroSubtitle, setHeroSubtitle] = useState(tenant.hero_subtitle ?? "");
  const [aboutHeading, setAboutHeading] = useState(tenant.about_heading ?? "");
  const [contactCtaTitle, setContactCtaTitle] = useState(tenant.contact_cta_title ?? "");
  const [contactCtaBody, setContactCtaBody] = useState(tenant.contact_cta_body ?? "");
  const [address, setAddress] = useState(tenant.address ?? "");
  const [facebookUrl, setFacebookUrl] = useState(tenant.facebook_url ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(tenant.youtube_url ?? "");
  const [tiktokUrl, setTiktokUrl] = useState(tenant.tiktok_url ?? "");
  const [twitterUrl, setTwitterUrl] = useState(tenant.twitter_url ?? "");
  const [heroStyle, setHeroStyle] = useState<LayoutConfig["heroStyle"]>(layout0.heroStyle);
  const [heroImageUrl, setHeroImageUrl] = useState(layout0.heroImageUrl ?? "");
  const [cardStyle, setCardStyle] = useState<LayoutConfig["cardStyle"]>(layout0.cardStyle);
  const [cardsPerRow, setCardsPerRow] = useState<LayoutConfig["cardsPerRow"]>(layout0.cardsPerRow);
  const [bankSlugs, setBankSlugs] = useState<string[]>(tenant.partner_banks ?? []);

  function toggleBank(slug: string) {
    setBankSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const previewTenant: TenantRow = {
    ...tenant,
    primary_color: primary,
    accent_color: accent,
    accent_dark_color: accentDark,
    slogan: slogan || null,
    hero_title: heroTitle || null,
    hero_subtitle: heroSubtitle || null,
  };
  const previewConfig: LayoutConfig = {
    heroStyle,
    heroImageUrl: heroImageUrl || null,
    cardStyle,
    cardsPerRow,
  };
  const previewVehicles = (
    sampleVehicles.length > 0 ? (sampleVehicles as Vehicle[]) : MOCK_VEHICLES
  ).slice(0, cardsPerRow);

  const brandVars = {
    "--brand-primary": primary,
    "--brand-primary-d": `color-mix(in srgb, ${primary}, black 28%)`,
    "--brand-primary-l": `color-mix(in srgb, ${primary}, white 14%)`,
    "--brand-accent": accent,
    "--brand-accent-d": accentDark,
  } as React.CSSProperties;

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/personalizar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primary_color: primary,
          accent_color: accent,
          accent_dark_color: accentDark,
          slogan,
          hero_title: heroTitle,
          hero_subtitle: heroSubtitle,
          about_heading: aboutHeading,
          contact_cta_title: contactCtaTitle,
          contact_cta_body: contactCtaBody,
          address,
          facebook_url: facebookUrl,
          youtube_url: youtubeUrl,
          tiktok_url: tiktokUrl,
          twitter_url: twitterUrl,
          layout_config: previewConfig,
          partner_banks: bankSlugs,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ ok: false, msg: data.error ?? "Não foi possível salvar." });
      } else {
        setStatus({ ok: true, msg: "Alterações salvas — seu site já está atualizado." });
      }
    } catch {
      setStatus({ ok: false, msg: "Erro de conexão. Tente novamente." });
    }
    setSaving(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      {/* ------- Formulário ------- */}
      <div className="space-y-5">
        {/* Cores */}
        <section className={cardClass}>
          <h2 className="font-display text-h3 font-semibold text-ink">Cores da marca</h2>
          <p className="mt-0.5 text-body-s text-n600">Aplicadas ao site público inteiro.</p>
          <div className="mt-4 space-y-3">
            <ColorField label="Cor principal" value={primary} onChange={setPrimary} />
            <ColorField label="Cor de destaque" value={accent} onChange={setAccent} />
            <ColorField label="Destaque (escuro)" value={accentDark} onChange={setAccentDark} />
          </div>
        </section>

        {/* Conteúdo do hero */}
        <section className={cardClass}>
          <h2 className="font-display text-h3 font-semibold text-ink">Topo do site</h2>
          <p className="mt-0.5 text-body-s text-n600">
            Slogan acima do título + título e subtítulo do hero.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="slogan" className={labelClass}>
                Slogan (frase curta acima do título)
              </label>
              <input
                id="slogan"
                className={`mt-1 ${inputClass}`}
                value={slogan}
                onChange={(e) => setSlogan(e.target.value)}
                placeholder="Seu próximo carro em Brasília"
                maxLength={80}
              />
            </div>
            <div>
              <label htmlFor="hero_title" className={labelClass}>
                Título
              </label>
              <input
                id="hero_title"
                className={`mt-1 ${inputClass}`}
                value={heroTitle}
                onChange={(e) => setHeroTitle(e.target.value)}
                placeholder="Seminovos com procedência"
                maxLength={80}
              />
            </div>
            <div>
              <label htmlFor="hero_subtitle" className={labelClass}>
                Subtítulo
              </label>
              <textarea
                id="hero_subtitle"
                className={`mt-1 ${inputClass} resize-none`}
                rows={3}
                value={heroSubtitle}
                onChange={(e) => setHeroSubtitle(e.target.value)}
                placeholder="Carros revisados, documentação em dia e financiamento facilitado."
                maxLength={200}
              />
            </div>
          </div>
        </section>

        {/* Seção "Sobre" — heading editorial + lista de cards */}
        <section className={cardClass}>
          <h2 className="font-display text-h3 font-semibold text-ink">Seção “Sobre nós”</h2>
          <p className="mt-0.5 text-body-s text-n600">
            Bloco editorial logo abaixo do hero — vantagens, confiança, diferenciais.
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="about_heading" className={labelClass}>
                Título da seção
              </label>
              <input
                id="about_heading"
                className={`mt-1 ${inputClass}`}
                value={aboutHeading}
                onChange={(e) => setAboutHeading(e.target.value)}
                placeholder={`Por que ${tenant.name}?`}
                maxLength={80}
              />
              <p className="mt-1 text-body-s text-n500">
                Vazio = usa o padrão “Por que {tenant.name}?”
              </p>
            </div>
            <AboutEditor initialItems={initialAboutItems} />
          </div>
        </section>

        {/* Bloco de contato */}
        <section className={cardClass}>
          <h2 className="font-display text-h3 font-semibold text-ink">Bloco de contato</h2>
          <p className="mt-0.5 text-body-s text-n600">
            Aparece como CTA final antes do rodapé.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="contact_cta_title" className={labelClass}>
                Título do CTA
              </label>
              <input
                id="contact_cta_title"
                className={`mt-1 ${inputClass}`}
                value={contactCtaTitle}
                onChange={(e) => setContactCtaTitle(e.target.value)}
                placeholder="Pronto para comprar?"
                maxLength={80}
              />
            </div>
            <div>
              <label htmlFor="contact_cta_body" className={labelClass}>
                Texto do CTA
              </label>
              <textarea
                id="contact_cta_body"
                className={`mt-1 ${inputClass} resize-none`}
                rows={2}
                value={contactCtaBody}
                onChange={(e) => setContactCtaBody(e.target.value)}
                placeholder="Fale com a gente no WhatsApp e tire suas dúvidas."
                maxLength={280}
              />
            </div>
            <div>
              <label htmlFor="address" className={labelClass}>
                Endereço da loja
              </label>
              <div className="relative mt-1">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-n500" />
                <input
                  id="address"
                  className={`${inputClass} pl-9`}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Av. Principal, 1234 — Brasília/DF"
                  maxLength={200}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Redes sociais */}
        <section className={cardClass}>
          <h2 className="font-display text-h3 font-semibold text-ink">Redes sociais</h2>
          <p className="mt-0.5 text-body-s text-n600">
            Links que aparecem no rodapé do seu site. Deixe em branco para esconder.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SocialField
              id="facebook_url"
              label="Facebook"
              value={facebookUrl}
              onChange={setFacebookUrl}
              placeholder="https://facebook.com/sua-loja"
            />
            <SocialField
              id="youtube_url"
              label="YouTube"
              value={youtubeUrl}
              onChange={setYoutubeUrl}
              placeholder="https://youtube.com/@sua-loja"
            />
            <SocialField
              id="tiktok_url"
              label="TikTok"
              value={tiktokUrl}
              onChange={setTiktokUrl}
              placeholder="https://tiktok.com/@sua-loja"
            />
            <SocialField
              id="twitter_url"
              label="X (Twitter)"
              value={twitterUrl}
              onChange={setTwitterUrl}
              placeholder="https://x.com/sua-loja"
            />
          </div>
        </section>

        {/* Bancos parceiros — todos os planos */}
        <section className={cardClass}>
          <h2 className="font-display text-h3 font-semibold text-ink">Bancos parceiros</h2>
          <p className="mt-0.5 text-body-s text-n600">
            Selecione os bancos com que sua loja trabalha. As logos aparecem no
            rodapé do seu site e em destaque na página de cada veículo.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {BANKS.map((bank) => {
              const selected = bankSlugs.includes(bank.slug);
              return (
                <button
                  type="button"
                  key={bank.slug}
                  onClick={() => toggleBank(bank.slug)}
                  aria-pressed={selected}
                  className={`flex items-center gap-2.5 rounded-lg border-2 px-2.5 py-2 text-left transition-all ${
                    selected
                      ? "border-signal bg-signal/5 shadow-sm"
                      : "border-n200 bg-white opacity-70 hover:border-n400 hover:opacity-100"
                  }`}
                >
                  <span className="relative h-7 w-16 shrink-0 overflow-hidden rounded">
                    <Image
                      src={bank.logo}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-contain"
                    />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-body-s font-medium text-ink">
                    {bank.name}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-body-s text-n500">
            {bankSlugs.length === 0
              ? "Nenhum banco selecionado — a seção não aparece no site."
              : `${bankSlugs.length} banco${bankSlugs.length > 1 ? "s" : ""} selecionado${bankSlugs.length > 1 ? "s" : ""}.`}
          </p>
        </section>

        {/* Layout — gated */}
        <section className={cardClass}>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-h3 font-semibold text-ink">Layout do site</h2>
            {!canEditLayout && (
              <span className="flex items-center gap-1 text-body-s text-n600">
                <Lock className="h-3.5 w-3.5" />
                Plano {planName}
              </span>
            )}
          </div>

          {!canEditLayout && (
            <p className="mt-2 rounded-lg bg-signal/10 px-3 py-2 text-body-s text-ink">
              A personalização de hero e cards faz parte dos planos Pro e Premium.
              No plano atual você ainda controla as cores e os textos.
            </p>
          )}

          <div
            className={`mt-4 space-y-4 ${!canEditLayout ? "pointer-events-none opacity-50" : ""}`}
            aria-disabled={!canEditLayout}
          >
            <div>
              <span className={labelClass}>Estilo do hero</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {HERO_STYLES.map((s) => (
                  <OptionButton
                    key={s}
                    selected={heroStyle === s}
                    disabled={!canEditLayout}
                    onClick={() => setHeroStyle(s)}
                    label={HERO_LABELS[s]}
                  />
                ))}
              </div>
            </div>

            {heroStyle === "image" && (
              <div>
                <label htmlFor="hero_image" className={labelClass}>
                  URL da imagem de fundo
                </label>
                <input
                  id="hero_image"
                  className={`mt-1 ${inputClass}`}
                  value={heroImageUrl}
                  onChange={(e) => setHeroImageUrl(e.target.value)}
                  placeholder="https://..."
                  disabled={!canEditLayout}
                />
              </div>
            )}

            <div>
              <span className={labelClass}>Estilo dos cards</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {CARD_STYLES.map((s) => (
                  <OptionButton
                    key={s}
                    selected={cardStyle === s}
                    disabled={!canEditLayout}
                    onClick={() => setCardStyle(s)}
                    label={CARD_LABELS[s]}
                  />
                ))}
              </div>
            </div>

            <div>
              <span className={labelClass}>Cards por fila</span>
              <div className="mt-1.5 flex gap-2">
                {([3, 4] as const).map((n) => (
                  <OptionButton
                    key={n}
                    selected={cardsPerRow === n}
                    disabled={!canEditLayout}
                    onClick={() => setCardsPerRow(n)}
                    label={String(n)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Salvar */}
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-signal px-5 py-2.5 font-semibold text-ink transition-colors hover:bg-signal-dark disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Salvar alterações"}
          </button>
          {status && (
            <span className={`text-body-s ${status.ok ? "text-ink" : "text-danger"}`}>
              {status.msg}
            </span>
          )}
        </div>
      </div>

      {/* ------- Preview ------- */}
      <div className="self-start lg:sticky lg:top-6">
        <div className="overflow-hidden rounded-xl border border-n200 bg-white">
          <div className="border-b border-n200 px-4 py-2 text-body-s text-n600">
            Pré-visualização do site
          </div>
          <div style={brandVars}>
            <div style={{ zoom: 0.62 }}>
              <StorefrontHero tenant={previewTenant} config={previewConfig} />
              <div className="bg-slate-50 p-5">
                <div
                  className={`grid gap-4 ${cardsPerRow === 4 ? "grid-cols-4" : "grid-cols-3"}`}
                >
                  {previewVehicles.map((v) => (
                    <VehicleCard key={v.id} vehicle={v} cardStyle={cardStyle} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-body-s text-ink">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 rounded-lg border border-n200 px-2 py-1.5 text-body-s text-ink outline-none focus:border-signal"
          aria-label={label}
        />
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 cursor-pointer rounded border border-n200 bg-white"
          aria-label={`${label} — seletor`}
        />
      </div>
    </div>
  );
}

function SocialField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type="url"
        className={`mt-1 ${inputClass}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function OptionButton({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-body-s font-medium transition-colors ${
        selected
          ? "border-signal bg-signal/10 text-ink"
          : "border-n200 text-n600 hover:border-n400"
      }`}
    >
      {label}
    </button>
  );
}
