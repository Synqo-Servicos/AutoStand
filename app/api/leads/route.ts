import { NextRequest, NextResponse } from "next/server";
import { createLead, listLeads } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { ApiError, withTenant } from "@/lib/api";
import { publicLeadSchema } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { notifyNewLead } from "@/lib/email/notify";

// Admin: list this tenant's leads.
export const GET = withTenant(async (req, { tenantId }) => {
  const sp = (req as NextRequest).nextUrl.searchParams;
  return NextResponse.json(
    await listLeads(tenantId, {
      status: sp.get("status") ?? undefined,
      source: sp.get("source") ?? undefined,
    }),
  );
});

// Public: a visitor submits an interest form. Tenant resolved by host.
// Não usa withTenant porque o autor não tem sessão — tenant vem do host.
// Endpoint público — protegido por rate limit (IP) + Turnstile, igual ao
// /api/marketplace/lead. Sem o captcha, era a única porta pública aberta:
// dava pra encher o /admin/leads da loja (e a caixa de e-mail do gestor).
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit("lead", ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente em alguns minutos." },
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

  const tenant = await getCurrentTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
  }

  const parsed = publicLeadSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first.path.length ? first.path.join(".") : "body";
    return NextResponse.json({ error: `${path}: ${first.message}` }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const lead = await createLead(tenant.id, {
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      vehicle_id: input.vehicle_id ?? null,
      message: input.message ?? null,
      source: input.source ?? "site",
      status: "novo",
    });
    // Fire-and-forget: avisa o gestor sem bloquear a resposta (nunca lança).
    void notifyNewLead(tenant, lead);
    return NextResponse.json(lead, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
