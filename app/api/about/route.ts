import { NextResponse } from "next/server";
import { createAboutItem, listAboutItems } from "@/lib/db";
import { parseBody, withTenant } from "@/lib/api";
import { aboutItemInputSchema } from "@/lib/schemas";

export const GET = withTenant(async (_req, { tenantId }) => {
  return NextResponse.json(await listAboutItems(tenantId));
});

export const POST = withTenant(async (req, { tenantId }) => {
  const input = await parseBody(req, aboutItemInputSchema);
  const existing = await listAboutItems(tenantId);
  if (existing.length >= 6) {
    return NextResponse.json(
      { error: "Limite de 6 itens na seção 'Sobre'." },
      { status: 413 },
    );
  }
  const item = await createAboutItem(tenantId, {
    icon_slug: input.icon_slug,
    title: input.title,
    description: input.description,
    position: existing.length,
  });
  return NextResponse.json(item, { status: 201 });
});

export const PATCH = withTenant(async (req, { tenantId }) => {
  const { aboutReorderSchema } = await import("@/lib/schemas");
  const { reorderAboutItems } = await import("@/lib/db");
  const { order } = await parseBody(req, aboutReorderSchema);
  await reorderAboutItems(tenantId, order);
  return NextResponse.json({ ok: true });
});
