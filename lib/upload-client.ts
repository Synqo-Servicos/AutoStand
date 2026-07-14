"use client";

import type { PresignKind } from "./blob-constants";

/**
 * Upload direto do browser pro S3, em dois passos:
 *
 *   1) POST /api/uploads/presign  → o servidor valida MIME/tamanho/ownership
 *      e devolve uma URL assinada (curta) + a `key` que ELE escolheu
 *   2) PUT na URL assinada        → os bytes vão direto pra AWS
 *
 * O arquivo nunca entra no body de uma function: na Vercel isso morre em
 * 4,5MB, na borda, com 413 FUNCTION_PAYLOAD_TOO_LARGE — antes do handler
 * rodar, então nenhum tratamento de erro nosso dispararia.
 *
 * Quem chama depois manda só a `key` pra rota de persistência.
 */

export interface PresignedUpload {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  headers: Record<string, string>;
}

export interface UploadTarget {
  kind: PresignKind;
  vehicleId?: number;
}

async function errorFrom(res: Response, fallback: string): Promise<Error> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return new Error(data?.error ?? fallback);
}

/** Sobe o arquivo e devolve a `key` + URL pública. Lança Error com msg do servidor. */
export async function uploadFile(file: File, target: UploadTarget): Promise<PresignedUpload> {
  const res = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: target.kind,
      contentType: file.type,
      size: file.size,
      vehicleId: target.vehicleId,
    }),
  });
  if (!res.ok) throw await errorFrom(res, "Não foi possível iniciar o upload.");
  const presigned = (await res.json()) as PresignedUpload;

  // Os headers vêm do servidor porque estão DENTRO da assinatura: mandar um
  // Content-Type diferente do assinado → SignatureDoesNotMatch. O
  // Content-Length o browser preenche sozinho (body de tamanho conhecido) e
  // bate com o `size` que assinamos, já que é o mesmo File.
  const put = await fetch(presigned.uploadUrl, {
    method: "PUT",
    headers: presigned.headers,
    body: file,
  });
  if (!put.ok) {
    throw new Error(
      `Falha ao enviar o arquivo (${put.status}). Verifique sua conexão e tente de novo.`,
    );
  }

  return presigned;
}
