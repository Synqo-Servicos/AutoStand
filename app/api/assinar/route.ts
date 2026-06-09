import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  createTenant,
  createUser,
  getCouponByCode,
  getPartnerByCode,
  getTenantBySlug,
  getUserByEmail,
  incrementCouponUse,
  incrementPartnerSignup,
} from "@/lib/db";
import { getPlan, isPlanSlug } from "@/lib/plans";
import { normalizeSlug, slugError } from "@/lib/slug";
import { createCheckoutSession } from "@/lib/checkout";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Cadastro self-service de uma concessionária.
 *
 * Cria o tenant como `incomplete` (site fora do ar até o 1º pagamento) e o
 * usuário admin. O Checkout é um seam — ver lib/checkout.ts.
 * Endpoint público — protegido por rate limit (IP) + Turnstile.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const rl = await checkRateLimit("signup", ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas de cadastro. Tente novamente em alguns minutos." },
      { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined },
    );
  }

  try {
    const body = await req.json();

    const captchaOk = await verifyTurnstile(body.turnstile_token, ip);
    if (!captchaOk) {
      return bad("Verificação de segurança falhou. Recarregue a página e tente novamente.");
    }

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

    const couponCodeRaw = String(body.coupon_code ?? "").trim().toUpperCase();
    const coupon = couponCodeRaw ? await getCouponByCode(couponCodeRaw) : null;
    if (couponCodeRaw && !coupon) return bad("Cupom inválido ou expirado.");

    const tenant = await createTenant({
      slug,
      name: dealershipName,
      plan,
      status: "suspended",
      subscription_status: "incomplete",
      referred_by: partner?.id ?? null,
      coupon_id: coupon?.id ?? null,
    });

    await createUser({
      email: adminEmail,
      password: await bcrypt.hash(adminPassword, 12),
      name: adminName,
      role: "tenant_admin",
      tenant_id: tenant.id,
    });

    if (partner) await incrementPartnerSignup(partner.id);
    if (coupon) await incrementCouponUse(coupon.id);

    const checkoutUrl = await createCheckoutSession(tenant, getPlan(plan), partner, coupon);

    return NextResponse.json({ ok: true, slug: tenant.slug, checkoutUrl }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
