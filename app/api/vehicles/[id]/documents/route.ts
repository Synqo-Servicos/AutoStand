import { NextRequest, NextResponse } from "next/server";
import { auth, getApiUserId } from "@/lib/auth";
import { addVehicleDocument, deleteVehicleDocument, getDocumentsByVehicle, getVehicle } from "@/lib/db";
import { UploadValidationError } from "@/lib/blob-constants";
import { deleteFromBlob, publicUrlForKey } from "@/lib/blob";
import { assertKeyInFolder, uploadFolder } from "@/lib/presign";
import { ApiError, parseBody, withTenant } from "@/lib/api";
import { documentCreateSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

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

/**
 * Grava um documento já subido direto no S3 (ver /api/uploads/presign).
 * Body: `{ key, name?, category, size?, mimeType? }` — JSON, não multipart.
 *
 * `size`/`mimeType` são metadados de exibição vindos do cliente; o zod os
 * limita à allowlist e ao teto de 20MB. O que realmente governa o objeto no
 * bucket é a assinatura, que fixou Content-Type e Content-Length no presign.
 */
export const POST = withTenant<{ id: string }>(async (req, { tenantId, params }) => {
  const vehicleId = Number(params.id);

  // Confirma ownership do veículo antes de aceitar o vínculo (mesmo motivo
  // da rota de fotos — evita FK órfã cross-tenant).
  if (!(await getVehicle(tenantId, vehicleId))) {
    throw new ApiError("Not found", 404);
  }

  const body = await parseBody(req, documentCreateSchema);

  // A key tem que ser uma que ESTE servidor assinou pra ESTA pasta.
  try {
    assertKeyInFolder(body.key, uploadFolder("document", tenantId, vehicleId));
  } catch (err) {
    if (err instanceof UploadValidationError) {
      throw new ApiError(err.message, err.status);
    }
    throw err;
  }

  const url = publicUrlForKey(body.key);
  const row = await addVehicleDocument({
    tenantId,
    vehicleId,
    // Sem nome do cliente, cai no basename da key (o nome original do arquivo
    // não chega mais aqui — ele nunca sai do browser).
    name: body.name || body.key.split("/").pop()!,
    category: body.category,
    url,
    size: body.size ?? null,
    mimeType: body.mimeType ?? null,
    uploadedBy: await getApiUserId(),
  });
  return NextResponse.json(row, { status: 201 });
});

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
