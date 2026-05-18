import { and, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { db } from "@/lib/db";
import { demand_events } from "@/lib/schema";

/**
 * Inteligência de demanda — registra o comportamento ANÔNIMO de quem compra
 * (buscas e visualizações) e agrega em sinais de demanda para a loja.
 *
 * Sem dado pessoal: só os filtros usados e os atributos dos veículos vistos.
 * `tenant_id` null = evento no marketplace AutoStand; preenchido = no site da loja.
 */

const WINDOW_DAYS = 30;

export interface SearchEventInput {
  tenantId: number | null;
  brand?: string | null;
  bodyType?: string | null;
  fuel?: string | null;
  transmission?: string | null;
  city?: string | null;
  /** Teto de preço filtrado, em centavos. */
  price?: number | null;
  yearMin?: number | null;
  searchTerm?: string | null;
}

export interface ViewEventInput {
  tenantId: number | null;
  vehicleId: number;
  brand: string;
  model: string;
  bodyType?: string | null;
  /** Preço do veículo, em centavos. */
  price: number;
}

/** Registra uma busca. Fire-and-forget — nunca derruba a página. */
export async function recordSearch(input: SearchEventInput): Promise<void> {
  const hasSignal =
    input.brand || input.bodyType || input.fuel || input.transmission ||
    input.city || input.price || input.yearMin || input.searchTerm;
  if (!hasSignal) return;
  try {
    await db.insert(demand_events).values({
      tenant_id: input.tenantId,
      event_type: "search",
      brand: input.brand ?? null,
      body_type: input.bodyType ?? null,
      fuel: input.fuel ?? null,
      transmission: input.transmission ?? null,
      city: input.city ?? null,
      price: input.price ?? null,
      year_min: input.yearMin ?? null,
      search_term: input.searchTerm ?? null,
    });
  } catch {
    /* telemetria não pode quebrar a navegação */
  }
}

/** Registra a visualização de um veículo. Fire-and-forget. */
export async function recordView(input: ViewEventInput): Promise<void> {
  try {
    await db.insert(demand_events).values({
      tenant_id: input.tenantId,
      event_type: "view",
      vehicle_id: input.vehicleId,
      brand: input.brand,
      model: input.model,
      body_type: input.bodyType ?? null,
      price: input.price,
    });
  } catch {
    /* idem */
  }
}

// --- Agregação ---

export interface RankItem {
  label: string;
  count: number;
}

export interface DemandSnapshot {
  scope: "marketplace" | "loja";
  windowDays: number;
  totalSearches: number;
  totalViews: number;
  topBrands: RankItem[];
  topBodyTypes: RankItem[];
  priceBuckets: RankItem[];
  topCities: RankItem[];
  mostViewed: RankItem[];
}

type Scope = "marketplace" | { tenantId: number };

function sinceISO(): string {
  return new Date(Date.now() - WINDOW_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

const PRICE_BUCKETS: { label: string; max: number }[] = [
  { label: "Até R$ 30 mil", max: 3_000_000 },
  { label: "R$ 30–50 mil", max: 5_000_000 },
  { label: "R$ 50–80 mil", max: 8_000_000 },
  { label: "R$ 80–120 mil", max: 12_000_000 },
  { label: "Acima de R$ 120 mil", max: Infinity },
];

/** Snapshot de demanda dos últimos 30 dias para um escopo. */
export async function getDemandSnapshot(scope: Scope): Promise<DemandSnapshot> {
  const since = sinceISO();
  const scopeCond: SQL =
    scope === "marketplace"
      ? isNull(demand_events.tenant_id)
      : eq(demand_events.tenant_id, scope.tenantId);

  const base = (type: "search" | "view") =>
    and(scopeCond, gte(demand_events.created_at, since), eq(demand_events.event_type, type));

  async function rankBy(column: SQLiteColumn, type: "search" | "view"): Promise<RankItem[]> {
    const rows = await db
      .select({ label: column, count: sql<number>`count(*)` })
      .from(demand_events)
      .where(and(base(type), isNotNull(column)))
      .groupBy(column)
      .orderBy(desc(sql`count(*)`))
      .limit(6);
    return rows
      .filter((r) => r.label != null && String(r.label).length > 0)
      .map((r) => ({ label: String(r.label), count: Number(r.count) }));
  }

  async function countOf(type: "search" | "view"): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(demand_events)
      .where(base(type));
    return Number(row?.n ?? 0);
  }

  async function priceBuckets(): Promise<RankItem[]> {
    const rows = await db
      .select({ price: demand_events.price })
      .from(demand_events)
      .where(and(base("search"), isNotNull(demand_events.price)));
    const counts = PRICE_BUCKETS.map(() => 0);
    for (const { price } of rows) {
      if (price == null) continue;
      const idx = PRICE_BUCKETS.findIndex((b) => price < b.max);
      if (idx >= 0) counts[idx]++;
    }
    return PRICE_BUCKETS.map((b, i) => ({ label: b.label, count: counts[i] })).filter(
      (b) => b.count > 0,
    );
  }

  async function mostViewed(): Promise<RankItem[]> {
    const rows = await db
      .select({
        brand: demand_events.brand,
        model: demand_events.model,
        count: sql<number>`count(*)`,
      })
      .from(demand_events)
      .where(and(base("view"), isNotNull(demand_events.brand)))
      .groupBy(demand_events.brand, demand_events.model)
      .orderBy(desc(sql`count(*)`))
      .limit(6);
    return rows.map((r) => ({
      label: [r.brand, r.model].filter(Boolean).join(" ") || "—",
      count: Number(r.count),
    }));
  }

  const [
    totalSearches, totalViews, topBrands, topBodyTypes, topCities, buckets, viewed,
  ] = await Promise.all([
    countOf("search"),
    countOf("view"),
    rankBy(demand_events.brand, "search"),
    rankBy(demand_events.body_type, "search"),
    rankBy(demand_events.city, "search"),
    priceBuckets(),
    mostViewed(),
  ]);

  return {
    scope: scope === "marketplace" ? "marketplace" : "loja",
    windowDays: WINDOW_DAYS,
    totalSearches,
    totalViews,
    topBrands,
    topBodyTypes,
    priceBuckets: buckets,
    topCities,
    mostViewed: viewed,
  };
}
