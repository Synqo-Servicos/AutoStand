import { NextResponse } from "next/server";
import { ApiError, withSuperAdmin } from "@/lib/api";
import { createPartner, getPartnerByCodeRaw, listPartners } from "@/lib/db";
import { normalizeSlug } from "@/lib/slug";

export const GET = withSuperAdmin(async () => {
  return NextResponse.json(await listPartners());
});

export const POST = withSuperAdmin(async (req) => {
  const body = await req.json();

  const name = String(body.name ?? "").trim();
  const code = normalizeSlug(String(body.code ?? ""));
  const discount_type = body.discount_type === "amount" ? "amount" : "percent";
  const discount_value = Math.max(0, Math.round(Number(body.discount_value) || 0));
  const status = body.status === "inactive" ? "inactive" : "active";
  const max_uses =
    body.max_uses != null && body.max_uses !== ""
      ? Math.max(1, Math.round(Number(body.max_uses)))
      : null;
  const expires_at =
    typeof body.expires_at === "string" && body.expires_at.trim()
      ? body.expires_at.trim()
      : null;

  if (!name) throw new ApiError("Informe o nome do parceiro.", 400);
  if (code.length < 3) throw new ApiError("O código precisa de ao menos 3 caracteres.", 400);
  if (discount_type === "percent" && discount_value > 100) {
    throw new ApiError("O percentual de desconto não pode passar de 100.", 400);
  }
  if (await getPartnerByCodeRaw(code)) {
    throw new ApiError("Já existe um parceiro com este código.", 400);
  }

  const partner = await createPartner({
    name,
    code,
    discount_type,
    discount_value,
    status,
    max_uses,
    expires_at,
  });
  return NextResponse.json(partner, { status: 201 });
});
