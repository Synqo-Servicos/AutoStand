import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserById, setUserPassword } from "@/lib/db";
import { passwordFingerprint, verifyResetToken } from "@/lib/reset-token";

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Consome o token de reset e define a nova senha. Token de uso único: o
 * fingerprint embutido tem que bater com a senha atual — depois do reset a
 * senha muda e o link morre. `setUserPassword` também limpa must_change_password.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { token?: unknown; password?: unknown };
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";

  let payload: ReturnType<typeof verifyResetToken>;
  try {
    payload = verifyResetToken(token);
  } catch (err) {
    console.error("[reset-password] verificação falhou (config?):", err);
    return NextResponse.json({ error: "Indisponível no momento." }, { status: 503 });
  }
  if (!payload) return bad("Link inválido ou expirado. Peça um novo.");
  if (password.length < 8) return bad("A senha precisa de pelo menos 8 caracteres.");

  const user = await getUserById(payload.userId);
  if (!user || passwordFingerprint(user.password) !== payload.pf) {
    return bad("Link inválido ou já usado. Peça um novo.");
  }

  await setUserPassword(user.id, await bcrypt.hash(password, 12));
  return NextResponse.json({ ok: true });
}
