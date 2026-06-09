/**
 * Schemas zod para validação de body em rotas /api/*. Centralizar aqui
 * evita drift entre o type do banco (lib/schema.ts) e o que o handler
 * aceita. Os enums espelham os de lib/constants.ts e o status do schema.
 *
 * Convenções:
 *  - `nullable().optional()` em campos opcionais que podem ser nulificados
 *    (ex.: limpar uma vehicle.version)
 *  - números em centavos sempre `nonNegativeInt` (sem decimal)
 *  - strings sempre `.trim()` + max razoável pra barrar buffer abuse
 */

import { z } from "zod";

const positiveInt = z.number().int().positive();
const nonNegativeInt = z.number().int().min(0);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use o formato YYYY-MM-DD");
const trimmed = (max: number) => z.string().trim().max(max);
const required = (max: number) => z.string().trim().min(1).max(max);

// ---------- Vehicles ----------

const TRANSMISSIONS = ["automatico", "manual", "cvt", "semi_automatico"] as const;
const FUELS = ["flex", "gasolina", "diesel", "etanol", "hibrido", "eletrico", "gnv"] as const;
const CONDITIONS = ["novo", "seminovo", "usado"] as const;
const VEHICLE_STATUS = ["disponivel", "reservado", "vendido"] as const;

export const vehicleInputSchema = z.object({
  brand: required(80),
  model: required(120),
  version: trimmed(120).nullable().optional(),
  year: z.number().int().min(1980).max(2100),
  year_manufacture: z.number().int().min(1980).max(2100).nullable().optional(),
  km: z.number().int().min(0).max(10_000_000),
  cost_price: nonNegativeInt,
  sale_price: nonNegativeInt,
  transmission: z.enum(TRANSMISSIONS),
  fuel: z.enum(FUELS),
  color: required(40),
  doors: z.number().int().min(2).max(6),
  body_type: trimmed(40).nullable().optional(),
  condition: z.enum(CONDITIONS),
  optionals: z.array(z.string().max(80)).max(80).nullable().optional(),
  armored: z.boolean().optional(),
  single_owner: z.boolean().optional(),
  plate: trimmed(10).nullable().optional(),
  fipe_code: trimmed(40).nullable().optional(),
  description: trimmed(4000).nullable().optional(),
  status: z.enum(VEHICLE_STATUS).optional(),
  primary_photo_url: z.string().url().nullable().optional(),
});

export const vehicleUpdateSchema = vehicleInputSchema.partial();

// ---------- Transactions ----------

const TX_TYPES = [
  "entrada", "saida", "despesa_direta", "despesa_fixa", "despesa_var", "comissao",
] as const;
const TX_REQUIRES_VEHICLE = new Set(["entrada", "saida", "despesa_direta"]);

export const transactionInputSchema = z
  .object({
    type: z.enum(TX_TYPES),
    amount: nonNegativeInt,
    date: isoDate,
    vehicle_id: positiveInt.nullable().optional(),
    seller_id: positiveInt.nullable().optional(),
    category: trimmed(80).nullable().optional(),
    buyer_name: trimmed(120).nullable().optional(),
    buyer_phone: trimmed(40).nullable().optional(),
    notes: trimmed(2000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (TX_REQUIRES_VEHICLE.has(data.type) && !data.vehicle_id) {
      ctx.addIssue({
        code: "custom",
        path: ["vehicle_id"],
        message: `obrigatório para transação do tipo "${data.type}"`,
      });
    }
    if (data.type === "despesa_direta" && !data.category) {
      ctx.addIssue({
        code: "custom",
        path: ["category"],
        message: "obrigatória em despesa direta",
      });
    }
  });

export const transactionUpdateSchema = z.object({
  type: z.enum(TX_TYPES).optional(),
  amount: nonNegativeInt.optional(),
  date: isoDate.optional(),
  vehicle_id: positiveInt.nullable().optional(),
  seller_id: positiveInt.nullable().optional(),
  category: trimmed(80).nullable().optional(),
  buyer_name: trimmed(120).nullable().optional(),
  buyer_phone: trimmed(40).nullable().optional(),
  notes: trimmed(2000).nullable().optional(),
});

// ---------- Sellers ----------

export const sellerInputSchema = z.object({
  name: required(120),
  phone: trimmed(40).nullable().optional(),
  email: z
    .union([z.string().email(), z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  document: trimmed(20).nullable().optional(),
  photo_url: z.string().url().nullable().optional(),
  commission_pct: z.number().int().min(0).max(100).nullable().optional(),
  commission_fixed_cents: nonNegativeInt.nullable().optional(),
  status: z.enum(["ativo", "desligado"]).optional(),
});

export const sellerUpdateSchema = sellerInputSchema.partial();

// ---------- Leads ----------

const LEAD_SOURCES = ["site", "whatsapp", "manual"] as const;
const LEAD_STATUS = ["novo", "contatado", "negociando", "convertido", "perdido"] as const;

/** Form público do storefront ou marketplace — sem autenticação. */
export const publicLeadSchema = z.object({
  name: required(120),
  phone: required(40),
  email: z
    .union([z.string().email(), z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  vehicle_id: positiveInt.nullable().optional(),
  message: trimmed(2000).nullable().optional(),
  source: z.enum(LEAD_SOURCES).optional(),
});

// ---------- About items (storefront) ----------

/** Allowlist de ícones Lucide pra seção "Sobre" — palette curada. */
export const ABOUT_ICONS = [
  "ShieldCheck", "Handshake", "CreditCard", "MessageCircle",
  "Wrench", "Award", "Truck", "Clock", "PhoneCall",
  "Star", "Heart", "ThumbsUp", "Sparkles", "Gauge",
  "MapPin", "Users", "FileCheck", "BadgeCheck",
] as const;
export type AboutIcon = (typeof ABOUT_ICONS)[number];

export const aboutItemInputSchema = z.object({
  icon_slug: z.enum(ABOUT_ICONS),
  title: required(60),
  description: required(280),
});

export const aboutItemUpdateSchema = aboutItemInputSchema.partial();

export const aboutReorderSchema = z.object({
  order: z.array(z.number().int().positive()).min(1).max(20),
});

// ---------- Tenant storefront config (subset editável pelo lojista) ----------

const optionalUrl = z
  .union([z.string().url(), z.literal("")])
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const tenantStorefrontSchema = z.object({
  // identidade visual
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accent_dark_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  // textos do hero + sobre + cta
  hero_title: trimmed(80).nullable().optional(),
  hero_subtitle: trimmed(200).nullable().optional(),
  slogan: trimmed(80).nullable().optional(),
  about_heading: trimmed(80).nullable().optional(),
  contact_cta_title: trimmed(80).nullable().optional(),
  contact_cta_body: trimmed(280).nullable().optional(),
  // contato + endereço
  city: trimmed(80).nullable().optional(),
  business_hours: trimmed(80).nullable().optional(),
  contact_email: z
    .union([z.string().email(), z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  whatsapp_number: trimmed(30).nullable().optional(),
  address: trimmed(200).nullable().optional(),
  // redes
  instagram_url: optionalUrl,
  facebook_url: optionalUrl,
  youtube_url: optionalUrl,
  tiktok_url: optionalUrl,
  twitter_url: optionalUrl,
  // identidade — URL devolvida pelo /api/upload ou null pra remover
  logo_url: z
    .union([z.string().max(2048), z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});

/** Tipos de upload de branding (logo + imagem de hero). */
export const UPLOAD_KINDS = ["logo", "hero"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

// ---------- Vehicle photos ----------

/** Lista ordenada de URLs pra reordenar as fotos do veículo. */
export const photoReorderSchema = z.object({
  order: z.array(z.string().url().max(2048)).min(1).max(50),
});

/** Atualização pelo admin do CRM (kanban). */
export const leadUpdateSchema = z.object({
  status: z.enum(LEAD_STATUS).optional(),
  message: trimmed(2000).nullable().optional(),
  name: trimmed(120).optional(),
  phone: trimmed(40).optional(),
  email: z
    .union([z.string().email(), z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});
