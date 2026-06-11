import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import { getApiTenantId } from "@/lib/auth";
import { getTenantById, getVehicleWithPhotos } from "@/lib/db";
import { capabilitiesFor } from "@/lib/plans";
import { formatBRL } from "@/lib/money";
import { FUEL_LABELS, TRANSMISSION_LABELS } from "@/lib/constants";
import type { Fuel, Transmission } from "@/lib/constants";

/**
 * Imagem do post de Instagram (1080×1080) de um veículo — recurso do plano Pro.
 *
 * Renderiza no servidor com `next/og` (Satori). A imagem é vestida pela
 * identidade da loja (cores `--brand-*`, logo) — sem nenhuma marca da
 * plataforma. Consumida pelo slideover do painel via `<img>` e download.
 */

type Params = { params: Promise<{ id: string }> };

// --- Cor de texto legível sobre um fundo (luminância relativa, WCAG) ---

function hexLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const channel = (i: number) => {
    const v = parseInt(n.slice(i, i + 2), 16) / 255;
    return Number.isNaN(v) ? 0 : v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function isLight(hex: string): boolean {
  return hexLuminance(hex) > 0.5;
}

/** Telefone só com dígitos → "(82) 99999-9999" (tolera o DDI 55). */
function formatPhone(raw: string | null): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}

const FONT_FILES = {
  sora600: new URL("../../../../../../lib/fonts/sora-latin-600-normal.woff", import.meta.url),
  sora700: new URL("../../../../../../lib/fonts/sora-latin-700-normal.woff", import.meta.url),
  inter400: new URL("../../../../../../lib/fonts/inter-latin-400-normal.woff", import.meta.url),
  inter600: new URL("../../../../../../lib/fonts/inter-latin-600-normal.woff", import.meta.url),
};

async function loadFont(url: URL): Promise<Buffer> {
  return readFile(url);
}

export async function GET(_req: NextRequest, { params }: Params) {
  const tenantId = await getApiTenantId();
  if (!tenantId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const tenant = await getTenantById(tenantId);
  if (!tenant) return NextResponse.json({ error: "Concessionária não encontrada" }, { status: 404 });

  // Gating no servidor — recurso do plano Pro.
  if (!capabilitiesFor(tenant.plan).instagramPost) {
    return NextResponse.json(
      { error: "A geração de posts faz parte do plano Pro." },
      { status: 403 },
    );
  }

  const { id } = await params;
  const vehicle = await getVehicleWithPhotos(tenant.id, Number(id));
  if (!vehicle) return NextResponse.json({ error: "Veículo não encontrado" }, { status: 404 });

  if (!vehicle.primary_photo_url) {
    return NextResponse.json(
      { error: "Adicione uma foto ao veículo antes de gerar o post." },
      { status: 422 },
    );
  }

  const primary = tenant.primary_color || "#0B1F33";
  const accent = tenant.accent_color || "#FF6A1A";
  const light = isLight(primary);
  const ink = light ? "#0B1F33" : "#FFFFFF";
  const muted = light ? "rgba(11,31,51,0.66)" : "rgba(255,255,255,0.74)";
  const pillBg = light ? "rgba(11,31,51,0.07)" : "rgba(255,255,255,0.14)";

  const titulo = [vehicle.brand, vehicle.model].filter(Boolean).join(" ");
  const anos =
    vehicle.year_manufacture && vehicle.year_manufacture !== vehicle.year
      ? `${vehicle.year_manufacture}/${vehicle.year}`
      : String(vehicle.year);
  const specs = [
    anos,
    `${vehicle.km.toLocaleString("pt-BR")} km`,
    TRANSMISSION_LABELS[vehicle.transmission as Transmission] ?? vehicle.transmission,
    FUEL_LABELS[vehicle.fuel as Fuel] ?? vehicle.fuel,
  ].join("  ·  ");

  const badges: string[] = [];
  if (vehicle.single_owner) badges.push("Único dono");
  if (vehicle.armored) badges.push("Blindado");
  for (const opt of vehicle.optionals ?? []) {
    if (badges.length >= 3) break;
    badges.push(opt);
  }

  const phone = formatPhone(tenant.whatsapp_number);

  const [sora600, sora700, inter400, inter600] = await Promise.all([
    loadFont(FONT_FILES.sora600),
    loadFont(FONT_FILES.sora700),
    loadFont(FONT_FILES.inter400),
    loadFont(FONT_FILES.inter600),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1080px",
          height: "1080px",
          display: "flex",
          flexDirection: "column",
          backgroundColor: primary,
          fontFamily: "Inter",
        }}
      >
        {/* Foto do veículo */}
        <div style={{ display: "flex", position: "relative", width: "1080px", height: "612px" }}>
          <img
            src={vehicle.primary_photo_url}
            width={1080}
            height={612}
            style={{ width: "1080px", height: "612px", objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "0px",
              left: "0px",
              width: "1080px",
              height: "200px",
              background: `linear-gradient(to bottom, rgba(0,0,0,0), ${primary})`,
            }}
          />
        </div>

        {/* Faixa de destaque na cor de acento */}
        <div style={{ display: "flex", width: "1080px", height: "8px", backgroundColor: accent }} />

        {/* Painel de dados */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            padding: "52px 64px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontFamily: "Sora", fontWeight: 700, fontSize: "60px", color: ink, lineHeight: 1.04 }}>
              {titulo}
            </div>
            {vehicle.version && (
              <div style={{ display: "flex", fontSize: "30px", color: muted, marginTop: "6px" }}>
                {vehicle.version}
              </div>
            )}
            <div style={{ display: "flex", fontSize: "27px", color: muted, marginTop: "18px" }}>
              {specs}
            </div>
            {badges.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", marginTop: "22px" }}>
                {badges.map((b) => (
                  <div
                    key={b}
                    style={{
                      display: "flex",
                      fontSize: "23px",
                      fontFamily: "Sora",
                      fontWeight: 600,
                      color: ink,
                      backgroundColor: pillBg,
                      borderRadius: "999px",
                      padding: "9px 20px",
                      marginRight: "10px",
                    }}
                  >
                    {b}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: "22px", color: muted }}>Por</div>
              <div style={{ display: "flex", fontFamily: "Sora", fontWeight: 700, fontSize: "56px", color: ink }}>
                {formatBRL(vehicle.sale_price)}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              {tenant.logo_url ? (
                <img src={tenant.logo_url} height={56} style={{ height: "56px", objectFit: "contain" }} />
              ) : (
                <div style={{ display: "flex", fontFamily: "Sora", fontWeight: 700, fontSize: "30px", color: ink }}>
                  {tenant.name}
                </div>
              )}
              {phone && (
                <div style={{ display: "flex", fontSize: "24px", color: muted, marginTop: "10px" }}>
                  {phone}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      fonts: [
        { name: "Sora", data: sora600, weight: 600, style: "normal" },
        { name: "Sora", data: sora700, weight: 700, style: "normal" },
        { name: "Inter", data: inter400, weight: 400, style: "normal" },
        { name: "Inter", data: inter600, weight: 600, style: "normal" },
      ],
    },
  );
}
