import { and, asc, eq } from "drizzle-orm";
import { tenant_about_items } from "@/lib/schema";
import type { NewTenantAboutItem, TenantAboutItemRow } from "@/lib/schema";
import { db } from "./client";

export async function listAboutItems(tenantId: number): Promise<TenantAboutItemRow[]> {
  return db
    .select()
    .from(tenant_about_items)
    .where(eq(tenant_about_items.tenant_id, tenantId))
    .orderBy(asc(tenant_about_items.position), asc(tenant_about_items.id));
}

export async function createAboutItem(
  tenantId: number,
  input: Pick<NewTenantAboutItem, "icon_slug" | "title" | "description" | "position">,
): Promise<TenantAboutItemRow> {
  const [row] = await db
    .insert(tenant_about_items)
    .values({ ...input, tenant_id: tenantId })
    .returning();
  return row;
}

export async function updateAboutItem(
  tenantId: number,
  id: number,
  input: Partial<Pick<NewTenantAboutItem, "icon_slug" | "title" | "description" | "position">>,
): Promise<TenantAboutItemRow | null> {
  await db
    .update(tenant_about_items)
    .set(input)
    .where(and(eq(tenant_about_items.tenant_id, tenantId), eq(tenant_about_items.id, id)));
  const [row] = await db
    .select()
    .from(tenant_about_items)
    .where(and(eq(tenant_about_items.tenant_id, tenantId), eq(tenant_about_items.id, id)))
    .limit(1);
  return row ?? null;
}

export async function deleteAboutItem(tenantId: number, id: number): Promise<void> {
  await db
    .delete(tenant_about_items)
    .where(and(eq(tenant_about_items.tenant_id, tenantId), eq(tenant_about_items.id, id)));
}

/** Reordena itens — array de ids na nova ordem. position = índice. */
export async function reorderAboutItems(
  tenantId: number,
  orderedIds: number[],
): Promise<void> {
  if (orderedIds.length === 0) return;
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(tenant_about_items)
        .set({ position: i })
        .where(
          and(
            eq(tenant_about_items.tenant_id, tenantId),
            eq(tenant_about_items.id, orderedIds[i]),
          ),
        );
    }
  });
}
