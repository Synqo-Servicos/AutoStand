import { NextResponse } from "next/server";
import { z } from "zod";
import { addPayableAttachment, deletePayableAttachment, getPayable, getTransaction } from "@/lib/db";
import { ApiError, parseBody, withTenant } from "@/lib/api";
import { UploadValidationError } from "@/lib/blob-constants";
import { deleteFromBlob, publicUrlForKey } from "@/lib/blob";
import { assertKeyInFolder, uploadFolder } from "@/lib/presign";

/**
 * Body traz `key` (não `url`) — a mesma convenção de
 * app/api/vehicles/[id]/photos/route.ts e .../documents/route.ts. O cliente
 * upload direto no S3 via /api/uploads/presign (kind "payable"), devolve só a
 * key, e É O SERVIDOR quem deriva a URL pública com ela — nunca aceita a URL
 * pronta do body.
 *
 * Por quê: sem `assertKeyInFolder`, um body com `url` arbitrária gravaria
 * qualquer objeto do bucket (inclusive de outro tenant) como anexo desta
 * conta — e o DELETE, que confia no que está no banco, apagaria esse blob
 * alheio via `deleteFromBlob(row.url)` depois. Fixando a key na pasta
 * `tenants/{tenantId}/payables`, a URL nunca escapa do que este tenant
 * realmente subiu.
 */
const attachmentSchema = z.object({
  key: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  size: z.number().int().positive().nullable().optional(),
  mime_type: z.string().max(100).nullable().optional(),
  transaction_id: z.number().int().positive().nullable().optional(),
});

export const POST = withTenant<{ id: string }>(async (req, { tenantId, params }) => {
  const payableId = Number(params.id);
  if (!Number.isInteger(payableId) || payableId <= 0) throw new ApiError("id inválido", 400);
  if (!(await getPayable(tenantId, payableId))) throw new ApiError("Conta não encontrada", 404);

  const input = await parseBody(req, attachmentSchema);

  // A key tem que ser uma que ESTE servidor assinou pra ESTA pasta.
  try {
    assertKeyInFolder(input.key, uploadFolder("payable", tenantId));
  } catch (err) {
    if (err instanceof UploadValidationError) throw new ApiError(err.message, err.status);
    throw err;
  }

  // Comprovante pode vir vinculado a uma transação (pagamento) já lançada —
  // confirma que ela é deste tenant antes de gravar a FK, mesmo motivo do
  // ownership check de veículo nas rotas de foto/documento.
  if (input.transaction_id != null && !(await getTransaction(tenantId, input.transaction_id))) {
    throw new ApiError("Transação não encontrada", 404);
  }

  const row = await addPayableAttachment(tenantId, payableId, {
    name: input.name,
    url: publicUrlForKey(input.key),
    size: input.size ?? null,
    mime_type: input.mime_type ?? null,
    transaction_id: input.transaction_id ?? null,
    uploaded_by: null,
  });
  return NextResponse.json(row, { status: 201 });
});

export const DELETE = withTenant<{ id: string }>(async (req, { tenantId }) => {
  const attachmentId = Number(req.nextUrl.searchParams.get("anexo"));
  if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
    throw new ApiError("anexo inválido", 400);
  }

  const row = await deletePayableAttachment(tenantId, attachmentId);
  if (!row) throw new ApiError("Anexo não encontrado", 404);

  // Best-effort: a linha já saiu do banco; um objeto órfão no S3 é
  // preferível a uma linha fantasma apontando pra arquivo inexistente. Seguro
  // porque `row.url` só pode ter sido gravada pelo POST acima (derivada de
  // key validada), nunca por input direto de um DELETE.
  await deleteFromBlob(row.url).catch((err) => console.error("[s3] delete anexo falhou:", err));

  return NextResponse.json({ ok: true });
});
