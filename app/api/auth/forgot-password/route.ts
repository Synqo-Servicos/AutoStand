import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db";
import { passwordFingerprint, signResetToken } from "@/lib/reset-token";
import { sendEmail } from "@/lib/email/send";
import { passwordReset } from "@/lib/email/templates";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function platformDomain(): string {
  return (process.env.PLATFORM_DOMAIN ?? "autostand.com.br").trim();
}

/**
 * Pede reset de senha. Público, rate-limited. SEMPRE devolve 200 — não vaza se
 * o e-mail existe (anti-enumeração). Se existir, envia o link (best-effort).
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit("passwordReset", ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente mais tarde." },
      { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (EMAIL_RE.test(email)) {
    try {
      const user = await getUserByEmail(email);
      if (user) {
        const token = signResetToken(user.id, passwordFingerprint(user.password));
        const resetUrl = `https://${platformDomain()}/resetar-senha?token=${encodeURIComponent(token)}`;
        const r = passwordReset({ resetUrl });
        await sendEmail({ to: user.email, subject: r.subject, html: r.html });
      }
    } catch (err) {
      console.error("[forgot-password] falhou:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
