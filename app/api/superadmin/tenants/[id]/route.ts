import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/auth";
import { deleteTenant, getTenantById, updateTenant } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const tenant = await getTenantById(Number(id));
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(tenant);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const body = await req.json();
    const tenant = await updateTenant(Number(id), body);
    if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(tenant);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await deleteTenant(Number(id));
  return NextResponse.json({ ok: true });
}
