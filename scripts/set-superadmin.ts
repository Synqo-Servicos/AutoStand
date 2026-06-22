import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db";
import { users } from "@/lib/schema";

/**
 * Cria/atualiza o super-admin da plataforma com uma senha provisória
 * (must_change_password = true → troca forçada no 1º login).
 *
 * Uso (via ECS RunTask dentro da VPC, ver .github/workflows/set-superadmin.yml):
 *   SUPERADMIN_EMAIL=... [SUPERADMIN_PASSWORD=...] tsx scripts/set-superadmin.ts
 *
 * Se SUPERADMIN_PASSWORD não for passada, gera uma aleatória e imprime.
 */

/** Senha provisória legível (12 chars, sem caracteres ambíguos). */
function genPassword(): string {
  return randomBytes(12).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
}

async function main() {
  const email = (process.env.SUPERADMIN_EMAIL ?? "").trim();
  if (!email) {
    console.error("ABORT: SUPERADMIN_EMAIL é obrigatório.");
    process.exit(1);
  }
  const password = process.env.SUPERADMIN_PASSWORD?.trim() || genPassword();
  const hash = await bcrypt.hash(password, 12);

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    await db
      .update(users)
      .set({ password: hash, role: "super_admin", tenant_id: null, must_change_password: true })
      .where(eq(users.id, existing.id));
    console.log(`✓ Super-admin ATUALIZADO: ${email}`);
  } else {
    await db.insert(users).values({
      email,
      password: hash,
      name: "Super Admin",
      role: "super_admin",
      tenant_id: null,
      must_change_password: true,
    });
    console.log(`✓ Super-admin CRIADO: ${email}`);
  }

  console.log("------------------------------------------------------------");
  console.log(`  E-mail:           ${email}`);
  console.log(`  Senha provisória: ${password}`);
  console.log("  (troca obrigatória no 1º login)");
  console.log("------------------------------------------------------------");

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
