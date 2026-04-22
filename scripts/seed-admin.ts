import bcrypt from "bcryptjs";
import { createDb, createUser, getUserByEmail } from "../lib/db";

async function main() {
  const email = process.argv[2] ?? process.env.ADMIN_EMAIL;
  const password = process.argv[3] ?? process.env.ADMIN_PASSWORD;
  const name = process.argv[4] ?? "Pedro Ivo";

  if (!email || !password) {
    console.error("Usage: npm run seed <email> <password> [name]");
    console.error("   or: set ADMIN_EMAIL and ADMIN_PASSWORD env vars");
    process.exit(1);
  }

  const db = createDb();
  const existing = getUserByEmail(email, db);
  if (existing) {
    console.log(`Usuário ${email} já existe.`);
    process.exit(0);
  }

  const hash = await bcrypt.hash(password, 12);
  createUser(email, hash, name, db);
  console.log(`Admin criado: ${email}`);
}

main().catch(console.error);
