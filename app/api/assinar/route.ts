import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  createTenant,
  createUser,
  getPartnerByCode,
  getTenantBySlug,
  getUserByEmail,
  incrementPartnerSignup,
} from "@/lib/db";
import { getPlan, isPlanSlug } from "@/lib/plans";
import { normalizeSlug, slugError } from "@/lib/slug";
import { createCheckoutSession } from "@/lib/checkout";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Cadastro self-service de uma concessionária.
 *
 * Cria o tenant como `incomplete` (site fora do ar até o 1º pagamento) e o
 * usuário admin. O Checkout é um seam — ver lib/checkout.ts.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const plan = String(body.plan ?? "");
    const slug = normalizeSlug(String(body.slug ?? ""));
    const dealershipName = String(body.dealership_name ?? "").trim();
    const adminName = String(body.admin_name ?? "").trim();
    const adminEmail = String(body.admin_email ?? "").trim().toLowerCase();
    const adminPassword = String(body.admin_password ?? "");
    const partnerCode = String(body.partner_code ?? "").trim();

    if (!isPlanSlug(plan)) return bad("Plano inválido.");
    const slugErr = slugError(slug);
    if (slugErr) return bad(slugErr);
    if (!dealershipName) return bad("Informe o nome da concessionária.");
    if (!adminName) return bad("Informe seu nome.");
    if (!EMAIL_RE.test(adminEmail)) return bad("E-mail inválido.");
    if (adminPassword.length < 8) return bad("A senha precisa de pelo menos 8 caracteres.");

    if (await getTenantBySlug(slug)) return bad("Este endereço já está em uso.");
    if (await getUserByEmail(adminEmail)) return bad("Já existe uma conta com este e-mail.");

    const partner = partnerCode ? await getPartnerByCode(partnerCode) : null;

    const tenant = await createTenant({
      slug,
      name: dealershipName,
      plan,
      status: "suspended", // vai ao ar só após o 1º pagamento (Fase 2)
      subscription_status: "incomplete",
      referred_by: partner?.id ?? null,
    });

    await createUser({
      email: adminEmail,
      password: await bcrypt.hash(adminPassword, 12),
      name: adminName,
      role: "tenant_admin",
      tenant_id: tenant.id,
    });

    if (partner) await incrementPartnerSignup(partner.id);

    // Seam da Fase 2 — hoje retorna null e o cliente segue para /assinar/sucesso.
    const checkoutUrl = await createCheckoutSession(tenant, getPlan(plan), partner);

    return NextResponse.json({ ok: true, slug: tenant.slug, checkoutUrl }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
