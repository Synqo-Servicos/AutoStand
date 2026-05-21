import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { lookupVehicleByPlate } from "@/lib/placa";

// fetch externo precisa de runtime Node.js — Edge não tem `fetch` com headers customizados certinhos.
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "tenant_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const placa = req.nextUrl.searchParams.get("placa");
  if (!placa) {
    return NextResponse.json({ error: "Parâmetro `placa` obrigatório." }, { status: 400 });
  }

  const result = await lookupVehicleByPlate(placa);
  if (!result.ok) {
    const status =
      result.reason === "not_configured" ? 503 :
      result.reason === "not_found"      ? 404 :
      result.reason === "rate_limited"   ? 429 :
      400;
    return NextResponse.json({ error: result.message, reason: result.reason }, { status });
  }
  return NextResponse.json(result.data);
}
