import { NextResponse } from "next/server";
import MercadoPagoConfig, { PreApproval } from "mercadopago";
import { getAdminTenant } from "@/lib/tenant";

function getMpClient() {
  return new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! });
}

export async function GET() {
  const tenant = await getAdminTenant();

  if (!tenant.mp_subscription_id) {
    return NextResponse.json({ error: "Sem assinatura ativa" }, { status: 404 });
  }

  const preApproval = new PreApproval(getMpClient());
  const subscription = await preApproval.get({ id: tenant.mp_subscription_id });

  const url = subscription.init_point;
  if (!url) {
    return NextResponse.json({ error: "Link de gestão indisponível" }, { status: 503 });
  }

  return NextResponse.redirect(url);
}
