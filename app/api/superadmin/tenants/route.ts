import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ApiError, withSuperAdmin } from "@/lib/api";
import { createTenant, createUser, getUserByEmail, listTenantsWithStats } from "@/lib/db";

export const GET = withSuperAdmin(async () => {
  return NextResponse.json(await listTenantsWithStats());
});

export const POST = withSuperAdmin(async (req) => {
  const body = await req.json();
  const { admin, ...tenantInput } = body;

  if (!tenantInput.slug || !tenantInput.name) {
    throw new ApiError("Slug e nome são obrigatórios", 400);
  }
  if (admin?.email && (await getUserByEmail(admin.email))) {
    throw new ApiError("Já existe um usuário com este email", 400);
  }

  const tenant = await createTenant(tenantInput);

  if (admin?.email && admin?.password) {
    await createUser({
      email: admin.email,
      password: await bcrypt.hash(admin.password, 12),
      name: admin.name?.trim() || tenant.name,
      role: "tenant_admin",
      tenant_id: tenant.id,
    });
  }

  return NextResponse.json(tenant, { status: 201 });
});
