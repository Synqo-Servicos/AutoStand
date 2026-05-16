import { migrate } from "drizzle-orm/libsql/migrator";
import { client, db } from "@/lib/db";

async function main() {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✅ Migrations aplicadas");
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
