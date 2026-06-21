import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { completeOnboarding } from "@/lib/db";

/** Marca o tutorial de primeiros passos como concluído/dispensado. */
export async function POST() {
  const session = await auth().catch(() => null);
  if (!session?.user?.id || session.user.role !== "tenant_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await completeOnboarding(Number(session.user.id));
  return NextResponse.json({ ok: true });
}
