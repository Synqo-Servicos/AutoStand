import { NextRequest, NextResponse } from "next/server";
import { createLead } from "@/lib/db";
import { getMarketplaceVehicleOwner } from "@/lib/marketplace";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";

/**
 * Lead originado no marketplace. Atribuído ao tenant dono do veículo,
 * com `source: marketplace` — aparece no /admin/leads da loja.
 * Endpoint público — protegido por rate limit (IP) + Turnstile.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const rl = await checkRateLimit("lead", ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns instantes e tente novamente." },
      { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined },
    );
  }

  try {
    const body = await req.json();

    const captchaOk = await verifyTurnstile(body.turnstile_token, ip);
    if (!captchaOk) {
      return NextResponse.json(
        { error: "Verificação de segurança falhou. Recarregue a página e tente novamente." },
        { status: 400 },
      );
    }

    const vehicleId = Number(body.vehicle_id);
    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();

    if (!vehicleId || !name || !phone) {
      return NextResponse.json(
        { error: "Nome, telefone e veículo são obrigatórios" },
        { status: 400 },
      );
    }

    const tenantId = await getMarketplaceVehicleOwner(vehicleId);
    if (!tenantId) {
      return NextResponse.json({ error: "Veículo indisponível" }, { status: 404 });
    }

    const lead = await createLead(tenantId, {
      name,
      phone,
      email: body.email ? String(body.email).trim() : null,
      vehicle_id: vehicleId,
      message: body.message ? String(body.message) : null,
      source: "marketplace",
      status: "novo",
    });
    return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
