import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { isSuperAdmin } from "@/lib/auth";
import { createTenant, createUser, getUserByEmail, listTenantsWithStats } from "@/lib/db";

export async function GET() {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await listTenantsWithStats());
}

export async function POST(req: NextRequest) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { admin, ...tenantInput } = body;

    if (!tenantInput.slug || !tenantInput.name) {
      return NextResponse.json({ error: "Slug e nome são obrigatórios" }, { status: 400 });
    }
    if (admin?.email && (await getUserByEmail(admin.email))) {
      return NextResponse.json({ error: "Já existe um usuário com este email" }, { status: 400 });
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
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
