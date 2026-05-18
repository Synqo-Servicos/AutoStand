import { NextRequest, NextResponse } from "next/server";
import { getApiTenantId } from "@/lib/auth";
import { updateTenant } from "@/lib/db";

/**
 * Adesão da concessionária ao marketplace AutoStand.
 * PATCH liga/desliga `marketplace_opt_in` — disponível em qualquer plano.
 */
export async function PATCH(req: NextRequest) {
  const tenantId = await getApiTenantId();
  if (tenantId === null) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const body = await req.json();
    if (typeof body.marketplace_opt_in !== "boolean") {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }
    const tenant = await updateTenant(tenantId, {
      marketplace_opt_in: body.marketplace_opt_in,
    });
    return NextResponse.json({ ok: true, marketplace_opt_in: tenant?.marketplace_opt_in ?? false });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
