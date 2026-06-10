import { eq } from "drizzle-orm";
import { users } from "@/lib/schema";
import type { UserRow } from "@/lib/schema";
import { db, type Tx } from "./client";

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row ?? null;
}

export async function getUserById(id: number): Promise<UserRow | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function listUsersByTenant(tenantId: number): Promise<UserRow[]> {
  return db.select().from(users).where(eq(users.tenant_id, tenantId));
}

export async function createUser(
  input: {
    email: string;
    password: string;
    name: string;
    role?: string;
    tenant_id?: number | null;
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
    })
    .returning();
  return row;
}
