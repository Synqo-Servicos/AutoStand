import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  db,
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
import { isValidDocument, normalizeDocument } from "@/lib/br-document";
import { normalizeSlug, slugError } from "@/lib/slug";
import { createCheckoutSession } from "@/lib/checkout";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { signPaymentToken } from "@/lib/payment-token";
import { discountedPriceCents } from "@/lib/coupon-pricing";

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

    // Enforcement server-side do aceite (impede bypass do checkbox via request direta).
    if (body.accepted_terms !== true) {
      return bad("É necessário aceitar os Termos de Uso e a Política de Privacidade.");
    }

    const plan = String(body.plan ?? "");
    const slug = normalizeSlug(String(body.slug ?? ""));
    const dealershipName = String(body.dealership_name ?? "").trim();
    const adminName = String(body.admin_name ?? "").trim();
    const adminEmail = String(body.admin_email ?? "").trim().toLowerCase();
    const adminPassword = String(body.admin_password ?? "");
    const partnerCode = String(body.partner_code ?? "").trim();
    const document = normalizeDocument(String(body.document ?? ""));

    if (!isPlanSlug(plan)) return bad("Plano inválido.");
    const slugErr = slugError(slug);
    if (slugErr) return bad(slugErr);
    if (!dealershipName) return bad("Informe o nome da concessionária.");
    if (!isValidDocument(document)) return bad("CPF ou CNPJ inválido.");
    if (!adminName) return bad("Informe seu nome.");
    if (!EMAIL_RE.test(adminEmail)) return bad("E-mail inválido.");
    if (adminPassword.length < 8) return bad("A senha precisa de pelo menos 8 caracteres.");

    if (await getTenantBySlug(slug)) return bad("Este endereço já está em uso.");
    if (await getUserByEmail(adminEmail)) return bad("Já existe uma conta com este e-mail.");

    const partner = partnerCode ? await getPartnerByCode(partnerCode) : null;

    const couponCodeRaw = String(body.coupon_code ?? "").trim().toUpperCase();
    const coupon = couponCodeRaw ? await getCouponByCode(couponCodeRaw) : null;
    if (couponCodeRaw && !coupon) return bad("Cupom inválido ou expirado.");

    // Reserva o uso do cupom atomicamente antes de criar qualquer registro.
    // O UPDATE condicional (used_count < max_uses) garante que pedidos simultâneos
    // não ultrapassem o limite — se retornar false, o cupom esgotou concorrentemente.
    if (coupon) {
      const reserved = await incrementCouponUse(coupon.id);
      if (!reserved) return bad("Cupom inválido ou expirado.");
    }

    const tenant = await db.transaction(async (tx) => {
      const t = await createTenant(
        {
          slug,
          name: dealershipName,
          document,
          plan,
          status: "suspended",
          subscription_status: "incomplete",
          referred_by: partner?.id ?? null,
          coupon_id: coupon?.id ?? null,
        },
        tx,
      );
      await createUser(
        {
          email: adminEmail,
          password: await bcrypt.hash(adminPassword, 12),
          name: adminName,
          role: "tenant_admin",
          tenant_id: t.id,
        },
        tx,
      );
      if (partner) await incrementPartnerSignup(partner.id, tx);
      return t;
    });

    if (process.env.CHECKOUT_MODE === "transparent") {
      const paymentToken = signPaymentToken({
        tenantId: tenant.id,
        planSlug: plan,
        couponId: coupon?.id ?? null,
      });
      const planObj = getPlan(plan);
      const amount = coupon ? discountedPriceCents(planObj, coupon) : planObj.priceMonthly;
      return NextResponse.json({ ok: true, slug: tenant.slug, paymentToken, amount }, { status: 201 });
    }

    const checkoutUrl = await createCheckoutSession(tenant, getPlan(plan), partner, coupon);
    return NextResponse.json({ ok: true, slug: tenant.slug, checkoutUrl }, { status: 201 });
  } catch (err) {
    console.error("[assinar] unexpected error:", err);
    return NextResponse.json({ error: "Erro interno. Tente novamente." }, { status: 500 });
  }
}
