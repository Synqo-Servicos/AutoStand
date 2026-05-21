/**
 * Endpoint TEMPORÁRIO de diagnóstico. REMOVER após uso.
 * Mostra para qual Turso a função está apontando e qual o estado dos tenants.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants } from "@/lib/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.DATABASE_URL ?? process.env.TURSO_DATABASE_URL ?? "(local)";
  // Mascara o host pra não vazar tudo no Slack/log.
  const masked = url.replace(/^libsql:\/\/([^.]+)\..*$/, (_m, host) => {
    return `libsql://${host.slice(0, 12)}…${host.slice(-6)}.…turso.io`;
  });
  const rows = await db.select().from(tenants);
  return NextResponse.json({
    db_url: masked,
    tenants: rows.map((t) => ({ id: t.id, slug: t.slug, name: t.name, plan: t.plan })),
  });
}
