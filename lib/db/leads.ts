import { and, desc, eq } from "drizzle-orm";
import { leads } from "@/lib/schema";
import type { LeadRow, NewLead } from "@/lib/schema";
import { db } from "./client";

export interface LeadFilters {
  status?: string;
  source?: string;
  vehicle_id?: number;
}

export async function listLeads(
  tenantId: number,
  filters: LeadFilters = {},
): Promise<LeadRow[]> {
  const conditions = [eq(leads.tenant_id, tenantId)];
  if (filters.status) conditions.push(eq(leads.status, filters.status));
  if (filters.source) conditions.push(eq(leads.source, filters.source));
  if (filters.vehicle_id) conditions.push(eq(leads.vehicle_id, filters.vehicle_id));

  return db
    .select()
    .from(leads)
    .where(and(...conditions))
    .orderBy(desc(leads.created_at));
}

export async function getLead(tenantId: number, id: number): Promise<LeadRow | null> {
  const [row] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.tenant_id, tenantId), eq(leads.id, id)))
    .limit(1);
  return row ?? null;
}

export async function createLead(
  tenantId: number,
  input: Omit<NewLead, "id" | "tenant_id" | "created_at">,
): Promise<LeadRow> {
  const [row] = await db
    .insert(leads)
    .values({ ...input, tenant_id: tenantId })
    .returning();
  return row;
}

const LEAD_UPDATE_FIELDS = [
  "name", "phone", "email", "message", "source", "status", "vehicle_id",
] as const;

export async function updateLead(
  tenantId: number,
  id: number,
  input: Partial<NewLead>,
): Promise<LeadRow | null> {
  const safe: Record<string, unknown> = {};
  for (const key of LEAD_UPDATE_FIELDS) {
    if (key in input) safe[key] = input[key as keyof NewLead];
  }
  if (Object.keys(safe).length > 0) {
    await db
      .update(leads)
      .set(safe)
      .where(and(eq(leads.tenant_id, tenantId), eq(leads.id, id)));
  }
  return getLead(tenantId, id);
}

export async function deleteLead(tenantId: number, id: number): Promise<void> {
  await db.delete(leads).where(and(eq(leads.tenant_id, tenantId), eq(leads.id, id)));
}
