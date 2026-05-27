import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { addVehicleDocument, deleteVehicleDocument, getDocumentsByVehicle, getVehicle } from "@/lib/db";
import {
  DOC_MIMES, MB, UploadValidationError,
  deleteFromBlob, uploadToBlob,
} from "@/lib/blob";

const DOC_UPLOAD_OPTIONS = {
  allowedMimes: DOC_MIMES,
  maxBytes: 20 * MB,
} as const;

type Params = { params: Promise<{ id: string }> };

const ALLOWED_CATEGORIES = new Set([
  "crlv", "laudo", "dut", "nf_peca", "os", "contrato", "historico", "outros",
]);

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user || session.user.role !== "tenant_admin" || !session.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  return NextResponse.json(
    await getDocumentsByVehicle(session.user.tenantId, Number(id)),
  );
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user || session.user.role !== "tenant_admin" || !session.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenantId = session.user.tenantId;
  const userId = session.user.id ? Number(session.user.id) : null;
  const { id } = await params;
  const vehicleId = Number(id);

  // Confirma ownership do veículo antes de aceitar upload (mesmo motivo
  // da rota de fotos — evita FK órfã cross-tenant).
  if (!(await getVehicle(tenantId, vehicleId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const name = (formData.get("name") as string | null)?.trim();
  const category = (formData.get("category") as string | null)?.trim() ?? "outros";

  if (!file) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });
  if (!ALLOWED_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Categoria inválida" }, { status: 400 });
  }
  const displayName = name && name.length > 0 ? name : file.name;
  let url: string;
  try {
    url = await uploadToBlob(
      file,
      `tenants/${tenantId}/vehicles/${vehicleId}/docs`,
      DOC_UPLOAD_OPTIONS,
    );
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
  const row = await addVehicleDocument({
    tenantId,
    vehicleId,
    name: displayName,
    category,
    url,
    size: file.size,
    mimeType: file.type || null,
    uploadedBy: userId,
  });
  return NextResponse.json(row, { status: 201 });
}

export async function DELETE(req: NextRequest, { params: _params }: Params) {
  const session = await auth();
  if (!session?.user || session.user.role !== "tenant_admin" || !session.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { documentId } = await req.json();
  if (!Number.isFinite(documentId)) {
    return NextResponse.json({ error: "documentId obrigatório" }, { status: 400 });
  }
  const removed = await deleteVehicleDocument(session.user.tenantId, Number(documentId));
  if (!removed) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }
  // Best-effort blob cleanup — não bloqueia em caso de falha.
  try {
    await deleteFromBlob(removed.url);
  } catch (err) {
    console.warn("falha ao apagar blob", err);
  }
  return NextResponse.json({ ok: true });
}
