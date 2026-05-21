import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { tenants, vehicles } from "@/lib/schema";

async function main() {
  const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN ?? process.env.DATABASE_AUTH_TOKEN;
  if (!url) throw new Error("TURSO_DATABASE_URL ausente");
  const client = createClient({ url, authToken });
  const db = drizzle(client);
  const all = await db.select({
    id: vehicles.id, t: vehicles.tenant_id, brand: vehicles.brand, model: vehicles.model,
    version: vehicles.version, year: vehicles.year, sale_price: vehicles.sale_price, status: vehicles.status,
  }).from(vehicles);
  const tnt = await db.select().from(tenants);
  const tMap = Object.fromEntries(tnt.map((t) => [t.id, t.slug]));
  for (const v of all) {
    console.log(`${v.id} [${tMap[v.t!] ?? v.t}] ${v.brand} ${v.model} ${v.version} ${v.year} R$${(v.sale_price/100).toLocaleString("pt-BR")} (${v.status})`);
  }
  client.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
