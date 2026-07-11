import { and, eq } from "drizzle-orm";
import { users } from "@/lib/schema";
import type { UserRow } from "@/lib/schema";
import { db, type Tx } from "./client";

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row ?? null;
}

/** E-mails de todos os super-admins (destinatários dos alertas internos). */
export async function getSuperAdminEmails(): Promise<string[]> {
  const rows = await db.select({ email: users.email }).from(users).where(eq(users.role, "super_admin"));
  return rows.map((r) => r.email);
}

/** E-mail do admin (primeiro tenant_admin) de um tenant — destinatário dos avisos ao cliente. */
export async function getTenantAdminEmail(tenantId: number): Promise<string | null> {
  const [row] = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.tenant_id, tenantId), eq(users.role, "tenant_admin")))
    .limit(1);
  return row?.email ?? null;
}

export async function getUserById(id: number): Promise<UserRow | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function createUser(
  input: {
    email: string;
    password: string;
    name: string;
    role?: string;
    tenant_id?: number | null;
    must_change_password?: boolean;
  },
  tx?: Tx,
): Promise<UserRow> {
  const orm = tx ?? db;
  const [row] = await orm
    .insert(users)
    .values({
      email: input.email,
      password: input.password,
      name: input.name,
      role: input.role ?? "tenant_admin",
      tenant_id: input.tenant_id ?? null,
      must_change_password: input.must_change_password ?? false,
    })
    .returning();
  return row;
}

/** Define uma nova senha (já hasheada) e limpa a flag de senha provisória. */
export async function setUserPassword(userId: number, passwordHash: string): Promise<void> {
  await db
    .update(users)
    .set({ password: passwordHash, must_change_password: false })
    .where(eq(users.id, userId));
}

/** Marca o tutorial de primeiros passos como concluído/dispensado. */
export async function completeOnboarding(userId: number): Promise<void> {
  await db.update(users).set({ onboarding_completed: true }).where(eq(users.id, userId));
}
