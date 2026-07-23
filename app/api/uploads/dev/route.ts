import { NextResponse } from "next/server";
import { ApiError, withTenant } from "@/lib/api";
import { DOC_MAX_BYTES } from "@/lib/blob-constants";
import { writeLocalObject } from "@/lib/blob";
import { HAS_S3 } from "@/lib/s3";

/**
 * Destino do PUT em dev sem S3 — o `uploadUrl` que /api/uploads/presign
 * devolve quando não há bucket (o caso do .env.local hoje).
 *
 * Existe só pra que o cliente tenha UM fluxo: presign → PUT → manda a key.
 * Sem isto, dev e produção divergiriam e o caminho de produção só seria
 * exercitado em produção.
 *
 * Fechado em produção por dois motivos independentes (HAS_S3 e NODE_ENV):
 * é a única rota que ainda recebe bytes no body, exatamente o que a migração
 * eliminou.
 */
export const PUT = withTenant(async (req, { tenantId }) => {
  if (HAS_S3 || process.env.NODE_ENV === "production") {
    throw new ApiError("Not found", 404);
  }

  const key = new URL(req.url).searchParams.get("key");
  // A key foi gerada pelo presign a partir da sessão; aqui só confirmamos
  // que continua sendo do tenant que está mandando o PUT.
  if (!key || !key.startsWith(`tenants/${tenantId}/`)) {
    throw new ApiError("Key inválida.", 400);
  }

  const buffer = Buffer.from(await req.arrayBuffer());
  if (buffer.byteLength === 0) throw new ApiError("Corpo vazio.", 400);
  if (buffer.byteLength > DOC_MAX_BYTES) throw new ApiError("Arquivo grande demais.", 413);

  await writeLocalObject(key, buffer);
  return NextResponse.json({ ok: true });
});
