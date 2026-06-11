import { migrate } from "drizzle-orm/node-postgres/migrator";
import { client, db } from "@/lib/db";

async function main() {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✅ Migrations aplicadas");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
