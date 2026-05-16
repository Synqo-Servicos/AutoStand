import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/auth";
import { deletePartner, getPartnerByCodeRaw, updatePartner } from "@/lib/db";
import { normalizeSlug } from "@/lib/slug";
import type { NewPartner } from "@/lib/schema";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const partnerId = Number((await params).id);
  try {
    const body = await req.json();
    const patch: Partial<NewPartner> = {};

    if (typeof body.name === "string") patch.name = body.name.trim();

    if (typeof body.code === "string") {
      const code = normalizeSlug(body.code);
      if (code.length < 3) {
        return NextResponse.json({ error: "Código muito curto." }, { status: 400 });
      }
      const existing = await getPartnerByCodeRaw(code);
      if (existing && existing.id !== partnerId) {
        return NextResponse.json(
          { error: "Já existe um parceiro com este código." },
          { status: 400 },
        );
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
    if (!partner) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(partner);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await deletePartner(Number((await params).id));
  return NextResponse.json({ ok: true });
}
