import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { setUserPassword } from "@/lib/db";
import { changePasswordSchema } from "@/lib/validation";

/** Troca de senha do admin da concessionária. Usada na troca forçada do 1º
 *  login (senha provisória) e também avulsamente. Limpa must_change_password. */
export async function POST(req: NextRequest) {
  const session = await auth().catch(() => null);
  if (!session?.user?.id || session.user.role !== "tenant_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const raw = await req.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }
  await setUserPassword(Number(session.user.id), await bcrypt.hash(parsed.data.password, 12));
  return NextResponse.json({ ok: true });
}
