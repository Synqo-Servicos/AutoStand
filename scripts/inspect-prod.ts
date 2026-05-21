/** Inspeção pontual do estado de prod — quais tenants e quanto inventário. */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, sql } from "drizzle-orm";
import { leads, tenants, transactions, vehicles } from "@/lib/schema";

async function main() {
  const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN ?? process.env.DATABASE_AUTH_TOKEN;
  if (!url) throw new Error("TURSO_DATABASE_URL ausente");
  const client = createClient({ url, authToken });
  const db = drizzle(client);
  const rows = await db.select().from(tenants);
  for (const t of rows) {
    const [{ vCount }] = await db
      .select({ vCount: sql<number>`count(*)` }).from(vehicles).where(eq(vehicles.tenant_id, t.id));
    const [{ lCount }] = await db
      .select({ lCount: sql<number>`count(*)` }).from(leads).where(eq(leads.tenant_id, t.id));
    const [{ tCount }] = await db
      .select({ tCount: sql<number>`count(*)` }).from(transactions).where(eq(transactions.tenant_id, t.id));
    console.log(JSON.stringify({
      id: t.id, slug: t.slug, name: t.name, domain: t.custom_domain,
      plan: t.plan, status: t.status, sub: t.subscription_status,
      vehicles: Number(vCount), leads: Number(lCount), transactions: Number(tCount),
    }));
  }
  client.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
