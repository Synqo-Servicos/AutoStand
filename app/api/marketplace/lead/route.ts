import { NextRequest, NextResponse } from "next/server";
import { createLead } from "@/lib/db";
import { getMarketplaceVehicleOwner } from "@/lib/marketplace";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { publicLeadSchema } from "@/lib/validation";

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido — JSON esperado." }, { status: 400 });
  }

  const captchaOk = await verifyTurnstile(
    (body as { turnstile_token?: string }).turnstile_token,
    ip,
  );
  if (!captchaOk) {
    return NextResponse.json(
      { error: "Verificação de segurança falhou. Recarregue a página e tente novamente." },
      { status: 400 },
    );
  }

  const parsed = publicLeadSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first.path.length ? first.path.join(".") : "body";
    return NextResponse.json({ error: `${path}: ${first.message}` }, { status: 400 });
  }
  const input = parsed.data;
  if (!input.vehicle_id) {
    return NextResponse.json({ error: "vehicle_id: obrigatório" }, { status: 400 });
  }

  try {
    const tenantId = await getMarketplaceVehicleOwner(input.vehicle_id);
    if (!tenantId) {
      return NextResponse.json({ error: "Veículo indisponível" }, { status: 404 });
    }

    const lead = await createLead(tenantId, {
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      vehicle_id: input.vehicle_id,
      message: input.message ?? null,
      source: "marketplace",
      status: "novo",
    });
    return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
  } catch (err) {
    console.error("[api/marketplace/lead] uncaught:", err);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
