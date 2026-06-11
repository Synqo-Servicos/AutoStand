import { NextResponse } from "next/server";
import { ApiError, parseBody, withTenant } from "@/lib/api";
import { updateTenant } from "@/lib/db";
import { marketplaceOptInSchema } from "@/lib/validation";

/**
 * Adesão da concessionária ao marketplace AutoStand.
 * PATCH liga/desliga `marketplace_opt_in` — disponível em qualquer plano.
 */
export const PATCH = withTenant(async (req, { tenantId }) => {
  const { marketplace_opt_in } = await parseBody(req, marketplaceOptInSchema);
  const tenant = await updateTenant(tenantId, { marketplace_opt_in });
  if (!tenant) throw new ApiError("Concessionária não encontrada", 404);
  return NextResponse.json({ ok: true, marketplace_opt_in: tenant.marketplace_opt_in });
});
