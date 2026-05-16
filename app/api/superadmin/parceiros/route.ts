import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/auth";
import { createPartner, getPartnerByCodeRaw, listPartners } from "@/lib/db";
import { normalizeSlug } from "@/lib/slug";

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET() {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await listPartners());
}

export async function POST(req: NextRequest) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
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

    if (!name) return bad("Informe o nome do parceiro.");
    if (code.length < 3) return bad("O código precisa de ao menos 3 caracteres.");
    if (discount_type === "percent" && discount_value > 100) {
      return bad("O percentual de desconto não pode passar de 100.");
    }
    if (await getPartnerByCodeRaw(code)) {
      return bad("Já existe um parceiro com este código.");
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
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
