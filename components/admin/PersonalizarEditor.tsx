"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { StorefrontHero } from "@/components/public/StorefrontHero";
import { VehicleCard } from "@/components/public/VehicleCard";
import { CARD_STYLES, HERO_STYLES, resolveLayoutConfig } from "@/lib/layout";
import type { LayoutConfig } from "@/lib/layout";
import type { TenantRow, VehicleRow } from "@/lib/schema";
import type { Vehicle } from "@/types/vehicle";

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
}: {
  tenant: TenantRow;
  sampleVehicles: VehicleRow[];
  canEditLayout: boolean;
  planName: string;
}) {
  const layout0 = resolveLayoutConfig(tenant.layout_config);

  const [primary, setPrimary] = useState(tenant.primary_color);
  const [accent, setAccent] = useState(tenant.accent_color);
  const [accentDark, setAccentDark] = useState(tenant.accent_dark_color);
  const [heroTitle, setHeroTitle] = useState(tenant.hero_title ?? "");
  const [heroSubtitle, setHeroSubtitle] = useState(tenant.hero_subtitle ?? "");
  const [heroStyle, setHeroStyle] = useState<LayoutConfig["heroStyle"]>(layout0.heroStyle);
  const [heroImageUrl, setHeroImageUrl] = useState(layout0.heroImageUrl ?? "");
  const [cardStyle, setCardStyle] = useState<LayoutConfig["cardStyle"]>(layout0.cardStyle);
  const [cardsPerRow, setCardsPerRow] = useState<LayoutConfig["cardsPerRow"]>(layout0.cardsPerRow);

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const previewTenant: TenantRow = {
    ...tenant,
    primary_color: primary,
    accent_color: accent,
    accent_dark_color: accentDark,
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
          hero_title: heroTitle,
          hero_subtitle: heroSubtitle,
          layout_config: previewConfig,
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
          <h2 className="font-display text-h3 font-semibold text-ink">Conteúdo do hero</h2>
          <div className="mt-4 space-y-3">
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
              />
            </div>
          </div>
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
