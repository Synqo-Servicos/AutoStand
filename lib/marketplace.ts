import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { tenants, vehicles, vehicle_photos } from "@/lib/schema";

/**
 * Camada de leitura do MARKETPLACE — a exceção sancionada à regra
 * "toda query filtra por tenant_id".
 *
 * Estas funções leem ATRAVÉS de todos os tenants, de propósito. Por isso:
 *  - são SOMENTE LEITURA;
 *  - devolvem apenas campos PÚBLICOS do veículo (nunca cost_price, fipe...);
 *  - só consideram tenants com `marketplace_opt_in` e status 'active';
 *  - só veículos com status 'disponivel'.
 * Nenhuma outra parte do código deve fazer consulta cross-tenant.
 */

export interface MarketplaceLoja {
  slug: string;
  name: string;
  city: string | null;
  logo_url: string | null;
  whatsapp_number: string | null;
}

export interface MarketplaceVehicle {
  id: number;
  brand: string;
  model: string;
  version: string | null;
  year: number;
  year_manufacture: number | null;
  km: number;
  sale_price: number;
  transmission: string;
  fuel: string;
  color: string;
  doors: number;
  body_type: string | null;
  condition: string;
  optionals: string[] | null;
  armored: boolean;
  single_owner: boolean;
  description: string | null;
  primary_photo_url: string | null;
  loja: MarketplaceLoja;
}

export interface MarketplaceVehicleDetail extends MarketplaceVehicle {
  photos: string[];
}

export interface MarketplaceLojaSummary extends MarketplaceLoja {
  vehicleCount: number;
}

export interface MarketplaceLojaProfile extends MarketplaceLoja {
  custom_domain: string | null;
  instagram_url: string | null;
  business_hours: string | null;
  vehicles: MarketplaceVehicle[];
}

export type MarketplaceSort = "recent" | "price_asc" | "price_desc" | "km_asc";

export interface MarketplaceFilters {
  brand?: string;
  fuel?: string;
  transmission?: string;
  body_type?: string;
  city?: string;
  year_min?: number;
  price_min?: number;
  price_max?: number;
  km_max?: number;
  search?: string;
  sort?: MarketplaceSort;
  /** Página 1-based. */
  page?: number;
}

export interface MarketplaceSearchResult {
  vehicles: MarketplaceVehicle[];
  /** Total de veículos que casam com os filtros (antes da paginação). */
  total: number;
}

/** Veículos por página na busca do marketplace. */
export const MARKETPLACE_PAGE_SIZE = 24;

// Colunas públicas — nunca incluir cost_price, fipe_code ou tenant_id aqui.
const VEHICLE_PUBLIC = {
  id: vehicles.id,
  brand: vehicles.brand,
  model: vehicles.model,
  version: vehicles.version,
  year: vehicles.year,
  year_manufacture: vehicles.year_manufacture,
  km: vehicles.km,
  sale_price: vehicles.sale_price,
  transmission: vehicles.transmission,
  fuel: vehicles.fuel,
  color: vehicles.color,
  doors: vehicles.doors,
  body_type: vehicles.body_type,
  condition: vehicles.condition,
  optionals: vehicles.optionals,
  armored: vehicles.armored,
  single_owner: vehicles.single_owner,
  description: vehicles.description,
  primary_photo_url: vehicles.primary_photo_url,
} as const;

const LOJA_PUBLIC = {
  loja_slug: tenants.slug,
  loja_name: tenants.name,
  loja_city: tenants.city,
  loja_logo: tenants.logo_url,
  loja_whatsapp: tenants.whatsapp_number,
} as const;

type JoinedRow = Record<string, unknown> & {
  loja_slug: string;
  loja_name: string;
  loja_city: string | null;
  loja_logo: string | null;
  loja_whatsapp: string | null;
};

function toMarketplaceVehicle(row: JoinedRow): MarketplaceVehicle {
  const { loja_slug, loja_name, loja_city, loja_logo, loja_whatsapp, ...v } = row;
  return {
    ...(v as Omit<MarketplaceVehicle, "loja">),
    loja: {
      slug: loja_slug,
      name: loja_name,
      city: loja_city,
      logo_url: loja_logo,
      whatsapp_number: loja_whatsapp,
    },
  };
}

/** Condições que tornam um veículo elegível ao marketplace. */
function eligible() {
  return [
    eq(vehicles.status, "disponivel"),
    eq(tenants.marketplace_opt_in, true),
    eq(tenants.status, "active"),
  ];
}

/** Coluna de ordenação. `recent` é neutro — não favorece loja alguma. */
function orderFor(sort: MarketplaceSort | undefined) {
  switch (sort) {
    case "price_asc": return asc(vehicles.sale_price);
    case "price_desc": return desc(vehicles.sale_price);
    case "km_asc": return asc(vehicles.km);
    default: return desc(vehicles.updated_at);
  }
}

/** Busca veículos em todas as lojas que aderiram ao marketplace. */
export async function searchMarketplaceVehicles(
  filters: MarketplaceFilters = {},
): Promise<MarketplaceSearchResult> {
  const conditions = eligible();

  if (filters.brand) conditions.push(eq(vehicles.brand, filters.brand));
  if (filters.fuel) conditions.push(eq(vehicles.fuel, filters.fuel));
  if (filters.transmission) conditions.push(eq(vehicles.transmission, filters.transmission));
  if (filters.body_type) conditions.push(eq(vehicles.body_type, filters.body_type));
  if (filters.city) conditions.push(eq(tenants.city, filters.city));
  if (filters.year_min) conditions.push(sql`${vehicles.year} >= ${filters.year_min}`);
  if (filters.price_min) conditions.push(sql`${vehicles.sale_price} >= ${filters.price_min}`);
  if (filters.price_max) conditions.push(sql`${vehicles.sale_price} <= ${filters.price_max}`);
  if (filters.km_max) conditions.push(sql`${vehicles.km} <= ${filters.km_max}`);
  if (filters.search) {
    const q = `%${filters.search}%`;
    conditions.push(
      sql`(${vehicles.brand} LIKE ${q} OR ${vehicles.model} LIKE ${q} OR ${vehicles.version} LIKE ${q})`,
    );
  }
  const where = and(...conditions);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(vehicles)
    .innerJoin(tenants, eq(vehicles.tenant_id, tenants.id))
    .where(where);

  const page = Math.max(1, filters.page ?? 1);
  const rows = await db
    .select({ ...VEHICLE_PUBLIC, ...LOJA_PUBLIC })
    .from(vehicles)
    .innerJoin(tenants, eq(vehicles.tenant_id, tenants.id))
    .where(where)
    .orderBy(orderFor(filters.sort))
    .limit(MARKETPLACE_PAGE_SIZE)
    .offset((page - 1) * MARKETPLACE_PAGE_SIZE);

  return { vehicles: rows.map((r) => toMarketplaceVehicle(r as JoinedRow)), total };
}

/** Um veículo do marketplace, com fotos. Null se não for elegível. */
export async function getMarketplaceVehicle(
  id: number,
): Promise<MarketplaceVehicleDetail | null> {
  const [row] = await db
    .select({ ...VEHICLE_PUBLIC, ...LOJA_PUBLIC })
    .from(vehicles)
    .innerJoin(tenants, eq(vehicles.tenant_id, tenants.id))
    .where(and(eq(vehicles.id, id), ...eligible()))
    .limit(1);
  if (!row) return null;

  const photos = await db
    .select({ url: vehicle_photos.url })
    .from(vehicle_photos)
    .where(eq(vehicle_photos.vehicle_id, id))
    .orderBy(vehicle_photos.order_idx);

  return { ...toMarketplaceVehicle(row as JoinedRow), photos: photos.map((p) => p.url) };
}

/** ID do tenant dono de um veículo elegível — usado para atribuir o lead. */
export async function getMarketplaceVehicleOwner(id: number): Promise<number | null> {
  const [row] = await db
    .select({ tenantId: vehicles.tenant_id })
    .from(vehicles)
    .innerJoin(tenants, eq(vehicles.tenant_id, tenants.id))
    .where(and(eq(vehicles.id, id), ...eligible()))
    .limit(1);
  return row?.tenantId ?? null;
}

/** Lojas que aderiram ao marketplace, com a contagem de veículos disponíveis. */
export async function listMarketplaceTenants(): Promise<MarketplaceLojaSummary[]> {
  const rows = await db
    .select({
      slug: tenants.slug,
      name: tenants.name,
      city: tenants.city,
      logo_url: tenants.logo_url,
      whatsapp_number: tenants.whatsapp_number,
      vehicleCount: sql<number>`count(${vehicles.id})`,
    })
    .from(tenants)
    .leftJoin(
      vehicles,
      and(eq(vehicles.tenant_id, tenants.id), eq(vehicles.status, "disponivel")),
    )
    .where(and(eq(tenants.marketplace_opt_in, true), eq(tenants.status, "active")))
    .groupBy(tenants.id)
    .orderBy(desc(sql`count(${vehicles.id})`));
  return rows;
}

/** Perfil de uma loja no marketplace + seu estoque disponível. */
export async function getMarketplaceTenantBySlug(
  slug: string,
): Promise<MarketplaceLojaProfile | null> {
  const [t] = await db
    .select()
    .from(tenants)
    .where(
      and(
        eq(tenants.slug, slug),
        eq(tenants.marketplace_opt_in, true),
        eq(tenants.status, "active"),
      ),
    )
    .limit(1);
  if (!t) return null;

  const rows = await db
    .select({ ...VEHICLE_PUBLIC, ...LOJA_PUBLIC })
    .from(vehicles)
    .innerJoin(tenants, eq(vehicles.tenant_id, tenants.id))
    .where(and(eq(vehicles.tenant_id, t.id), eq(vehicles.status, "disponivel")))
    .orderBy(desc(vehicles.updated_at));

  return {
    slug: t.slug,
    name: t.name,
    city: t.city,
    logo_url: t.logo_url,
    whatsapp_number: t.whatsapp_number,
    custom_domain: t.custom_domain,
    instagram_url: t.instagram_url,
    business_hours: t.business_hours,
    vehicles: rows.map((r) => toMarketplaceVehicle(r as JoinedRow)),
  };
}

/** Marcas e cidades distintas no marketplace — para os filtros da busca. */
export async function marketplaceFilterOptions(): Promise<{
  brands: string[];
  cities: string[];
}> {
  const brandRows = await db
    .selectDistinct({ brand: vehicles.brand })
    .from(vehicles)
    .innerJoin(tenants, eq(vehicles.tenant_id, tenants.id))
    .where(and(...eligible()));

  const cityRows = await db
    .selectDistinct({ city: tenants.city })
    .from(tenants)
    .where(and(eq(tenants.marketplace_opt_in, true), eq(tenants.status, "active")));

  return {
    brands: brandRows.map((r) => r.brand).sort((a, b) => a.localeCompare(b, "pt-BR")),
    cities: cityRows
      .map((r) => r.city)
      .filter((c): c is string => !!c)
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}
