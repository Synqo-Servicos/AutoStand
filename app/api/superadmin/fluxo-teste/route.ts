import { NextResponse } from "next/server";
import { ApiError, withSuperAdmin } from "@/lib/api";
import { createTenant, getTenantById, deleteTenant } from "@/lib/db";
import { createCheckoutSession, cancelMpSubscription } from "@/lib/checkout";
import { getPlan } from "@/lib/plans";
import type { CouponRow } from "@/lib/schema";

/** Cupom sintético (não persistido) que derruba o Básico p/ R$1,00. */
function diagCoupon(userId: number): CouponRow {
  return {
    id: -1,
    code: "DIAG",
    description: "diagnóstico",
    discount_type: "fixed",
    discount_value: 16890,
    max_uses: 1,
    used_count: 0,
    expires_at: null,
    partner_id: null,
    created_by: userId,
    created_at: "",
  } as CouponRow;
}

function tenantIdParam(req: Request): number {
  const raw = new URL(req.url).searchParams.get("tenantId");
  const n = raw ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n <= 0) throw new ApiError("Parâmetro 'tenantId' inválido.", 400);
  return n;
}

function assertDiagTenant(tenant: { slug: string } | null): void {
  if (tenant && !tenant.slug.startsWith("diag-")) {
    throw new ApiError("Rota de diagnóstico só opera tenants diag-.", 400);
  }
}

export const POST = withSuperAdmin(async (_req, { userId }) => {
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
  let checkoutUrl: string | null;
  try {
    checkoutUrl = await createCheckoutSession(
      tenant,
      getPlan("basico"),
      null,
      diagCoupon(userId),
    );
  } catch (err) {
    await deleteTenant(tenant.id);
    throw err;
  }
  return NextResponse.json(
    { tenantId: tenant.id, slug: tenant.slug, checkoutUrl },
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
