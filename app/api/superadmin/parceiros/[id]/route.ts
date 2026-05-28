import { NextResponse } from "next/server";
import { ApiError, withSuperAdmin } from "@/lib/api";
import { deletePartner, getPartnerByCodeRaw, updatePartner } from "@/lib/db";
import { normalizeSlug } from "@/lib/slug";
import type { NewPartner } from "@/lib/schema";

export const PATCH = withSuperAdmin<{ id: string }>(async (req, { params }) => {
  const partnerId = Number(params.id);
  const body = await req.json();
  const patch: Partial<NewPartner> = {};

  if (typeof body.name === "string") patch.name = body.name.trim();

  if (typeof body.code === "string") {
    const code = normalizeSlug(body.code);
    if (code.length < 3) throw new ApiError("Código muito curto.", 400);
    const existing = await getPartnerByCodeRaw(code);
    if (existing && existing.id !== partnerId) {
      throw new ApiError("Já existe um parceiro com este código.", 400);
    }
    patch.code = code;
  }

  if (body.discount_type === "percent" || body.discount_type === "amount") {
    patch.discount_type = body.discount_type;
  }
  if (body.discount_value != null) {
    patch.discount_value = Math.max(0, Math.round(Number(body.discount_value) || 0));
  }
  if (body.status === "active" || body.status === "inactive") {
    patch.status = body.status;
  }
  if ("max_uses" in body) {
    patch.max_uses = body.max_uses ? Math.max(1, Math.round(Number(body.max_uses))) : null;
  }
  if ("expires_at" in body) {
    patch.expires_at =
      typeof body.expires_at === "string" && body.expires_at.trim()
        ? body.expires_at.trim()
        : null;
  }

  const partner = await updatePartner(partnerId, patch);
  if (!partner) throw new ApiError("Not found", 404);
  return NextResponse.json(partner);
});

export const DELETE = withSuperAdmin<{ id: string }>(async (_req, { params }) => {
  await deletePartner(Number(params.id));
  return NextResponse.json({ ok: true });
});
