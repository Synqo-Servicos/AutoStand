import { NextResponse } from "next/server";
import { ApiError, withSuperAdmin } from "@/lib/api";
import { getTenantById, setTenantSubscriptionState } from "@/lib/db";
import { createTransparentSubscription } from "@/lib/checkout";
import { getPlan } from "@/lib/plans";
import { assertDiagTenant, diagCoupon } from "@/lib/diag";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Etapa 2 do diagnóstico transparente. Recebe o card_token tokenizado pelo
 * Card Brick do console e cria a assinatura R$1 do tenant `diag-` pelo MESMO
 * caminho do cliente (`createTransparentSubscription` — com reconcile,
 * idempotency key e tradução de recusa). Devolve o status já resolvido pro
 * console exibir. Só superadmin, só tenants `diag-`.
 */
export const POST = withSuperAdmin(async (req, { userId }) => {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    throw new ApiError("MERCADOPAGO_ACCESS_TOKEN não configurado.", 503);
  }

  const body = (await req.json().catch(() => ({}))) as {
    tenantId?: unknown;
    card_token?: unknown;
    payer_email?: unknown;
  };
  const tenantId = Number(body.tenantId);
  const cardToken = typeof body.card_token === "string" ? body.card_token : "";
  const payerEmail = typeof body.payer_email === "string" ? body.payer_email.trim().toLowerCase() : "";
  if (!Number.isInteger(tenantId) || tenantId <= 0) throw new ApiError("tenantId inválido.", 400);
  if (!cardToken) throw new ApiError("card_token ausente.", 400);
  if (!EMAIL_RE.test(payerEmail)) throw new ApiError("payer_email inválido.", 400);

  const tenant = await getTenantById(tenantId);
  if (!tenant) throw new ApiError("Tenant não encontrado.", 404);
  assertDiagTenant(tenant);

  let result;
  try {
    result = await createTransparentSubscription(
      tenant,
      getPlan("basico"),
      diagCoupon(userId),
      cardToken,
      payerEmail,
    );
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: err instanceof Error ? err.message : "Erro no Mercado Pago." },
      { status: 502 },
    );
  }

  if (result.status === "authorized") {
    // authorized sempre carrega id não-nulo (recusa lançada volta como
    // "rejected" com id null, tratada abaixo).
    await setTenantSubscriptionState(tenant.id, "authorized", result.id!);
    return NextResponse.json({ status: "authorized", mpSubscriptionId: result.id });
  }
  if (result.status === "pending" || result.status === "in_process") {
    return NextResponse.json({ status: "pending" });
  }
  return NextResponse.json({
    status: "rejected",
    detail: result.statusDetail,
    message: result.message ?? "Pagamento recusado.",
  });
});
