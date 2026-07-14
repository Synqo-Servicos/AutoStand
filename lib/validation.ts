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
import {
  CONDITIONS, FUELS, LEAD_INTERACTION_MANUAL_TYPES, LEAD_SOURCES, LEAD_STATUS,
  TRANSACTION_TYPES, TRANSMISSIONS, TX_REQUIRES_VEHICLE, VEHICLE_STATUS,
} from "@/lib/constants";
import { DOC_MAX_BYTES, DOC_MIMES, PRESIGN_KINDS } from "@/lib/blob-constants";

const positiveInt = z.number().int().positive();
const nonNegativeInt = z.number().int().min(0);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use o formato YYYY-MM-DD");
const trimmed = (max: number) => z.string().trim().max(max);
const required = (max: number) => z.string().trim().min(1).max(max);

// ---------- Vehicles ----------
// Enums de domínio vêm de lib/constants.ts (fonte única) — importados, não
// redeclarados, pra não divergir dos labels da UI.

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

export const transactionInputSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES),
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
  type: z.enum(TRANSACTION_TYPES).optional(),
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
  // centésimos de % (basis points): 10000 = 100%. Ver types/seller.ts.
  commission_pct: z.number().int().min(0).max(10000).nullable().optional(),
  commission_fixed_cents: nonNegativeInt.nullable().optional(),
  status: z.enum(["ativo", "desligado"]).optional(),
});

export const sellerUpdateSchema = sellerInputSchema.partial();

// ---------- Leads ----------

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

// ---------- Upload direto pro S3 (presign) ----------

/** Categorias de documento interno do veículo (espelha o <select> do admin). */
export const DOCUMENT_CATEGORIES = [
  "crlv", "laudo", "dut", "nf_peca", "os", "contrato", "historico", "outros",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/**
 * Pedido de URL assinada. O cliente diz o que quer subir; o servidor decide
 * se pode e ONDE — a `key` nunca vem daqui. MIME e tamanho são revalidados
 * em lib/presign.ts contra a regra do `kind` (este schema só checa a forma).
 */
export const presignRequestSchema = z.object({
  kind: z.enum(PRESIGN_KINDS),
  contentType: z.string().min(1).max(128),
  size: z.number().int().positive(),
  vehicleId: z.number().int().positive().optional(),
});

/** Key devolvida pelo cliente depois do PUT — sempre revalidada contra o folder. */
const uploadedKeySchema = z.string().min(1).max(512);

/** POST /api/upload — persiste (na verdade só resolve) a URL de logo/hero. */
export const brandingUploadSchema = z.object({
  key: uploadedKeySchema,
  kind: z.enum(UPLOAD_KINDS),
});

/** POST /api/vehicles/[id]/photos — grava a foto já subida. */
export const photoCreateSchema = z.object({
  key: uploadedKeySchema,
  set_primary: z.boolean().optional(),
});

/** POST /api/vehicles/[id]/documents — grava o documento já subido. */
export const documentCreateSchema = z.object({
  key: uploadedKeySchema,
  name: z.string().trim().max(200).optional(),
  category: z.enum(DOCUMENT_CATEGORIES).default("outros"),
  size: z.number().int().positive().max(DOC_MAX_BYTES).optional(),
  mimeType: z.enum(DOC_MIMES).optional(),
});

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

/** Interação registrada manualmente no histórico de um lead. */
export const leadInteractionInputSchema = z.object({
  type: z.enum(LEAD_INTERACTION_MANUAL_TYPES),
  body: trimmed(2000).nullable().optional(),
});

/** Troca de senha pelo admin da concessionária (forçada no 1º login). */
export const changePasswordSchema = z.object({
  password: z.string().min(8, "A senha precisa de ao menos 8 caracteres.").max(200),
});

// ---------- Superadmin: cupons & marketplace ----------

export const createCouponSchema = z.object({
  code: z.string().trim().min(3, "O código precisa de ao menos 3 caracteres.").max(50).transform((s) => s.toUpperCase()),
  description: z.string().trim().max(200).optional().nullable().transform((v) => v || null),
  discount_type: z.enum(["percentage", "fixed", "free_month"], {
    error: "Tipo de desconto inválido.",
  }),
  discount_value: z.number().optional(),
  max_uses: z.number().int().min(1).default(1),
  expires_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida — use YYYY-MM-DD.")
    .optional()
    .nullable()
    .transform((v) => v || null),
  partner_id: z
    .union([z.number().int().positive(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v == null || v === "" ? null : Number(v))),
});

export const marketplaceOptInSchema = z.object({
  marketplace_opt_in: z.boolean(),
});
