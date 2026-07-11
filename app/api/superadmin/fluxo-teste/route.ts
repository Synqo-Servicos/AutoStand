import { NextResponse } from "next/server";
import { ApiError, withSuperAdmin } from "@/lib/api";
import { createTenant, getTenantById, deleteTenant } from "@/lib/db";
import { cancelMpSubscription } from "@/lib/checkout";
import { assertDiagTenant, diagAmountCents } from "@/lib/diag";

function tenantIdParam(req: Request): number {
  const raw = new URL(req.url).searchParams.get("tenantId");
  const n = raw ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n <= 0) throw new ApiError("Parâmetro 'tenantId' inválido.", 400);
  return n;
}

/**
 * Etapa 1 do diagnóstico transparente: cria o tenant `diag-` (incomplete) e
 * devolve o valor a cobrar (R$1 via cupom DIAG). O pagamento acontece no
 * Card Brick do console → `fluxo-teste/pagar` (o MESMO fluxo do cliente).
 */
export const POST = withSuperAdmin(async () => {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    throw new ApiError("MERCADOPAGO_ACCESS_TOKEN não configurado.", 503);
  }
  const slug = `diag-${Date.now().toString(36)}`;
  const tenant = await createTenant({
    slug,
    name: "Diagnóstico",
    plan: "basico",
    status: "suspended",
    subscription_status: "incomplete",
  });
  return NextResponse.json(
    { tenantId: tenant.id, slug: tenant.slug, amount: diagAmountCents() },
    { status: 201 },
  );
});

export const GET = withSuperAdmin(async (req) => {
  const tenant = await getTenantById(tenantIdParam(req));
  if (!tenant) throw new ApiError("Tenant não encontrado.", 404);
  assertDiagTenant(tenant);
  return NextResponse.json({
    subscription_status: tenant.subscription_status,
    mp_subscription_id: tenant.mp_subscription_id,
  });
});

export const DELETE = withSuperAdmin(async (req) => {
  const id = tenantIdParam(req);
  const tenant = await getTenantById(id);
  assertDiagTenant(tenant);
  if (tenant?.mp_subscription_id) {
    await cancelMpSubscription(tenant.mp_subscription_id);
  }
  await deleteTenant(id);
  return NextResponse.json({ ok: true });
});
