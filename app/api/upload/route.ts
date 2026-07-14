import { NextResponse } from "next/server";
import { ApiError, parseBody, withTenant } from "@/lib/api";
import { UploadValidationError } from "@/lib/blob-constants";
import { publicUrlForKey } from "@/lib/blob";
import { assertKeyInFolder, uploadFolder } from "@/lib/presign";
import { brandingUploadSchema } from "@/lib/validation";

/**
 * Confirma um upload de identidade visual (logo, hero) — scope tenant.
 *
 * Body: `{ key, kind }` — JSON, não mais multipart. O arquivo já subiu direto
 * pro S3 via /api/uploads/presign (o body de uma function na Vercel estoura em
 * 4,5MB, na borda). Aqui só validamos que a key é de uma pasta de branding
 * DESTE tenant e devolvemos a URL pública derivada no servidor — o cliente
 * persiste depois via PATCH /api/personalizar (logo_url ou
 * layout_config.heroImageUrl).
 *
 * Cleanup de URLs antigas continua por conta do usuário trocar e salvar — o
 * endpoint não tem contexto pra saber qual era a anterior.
 */
export const POST = withTenant(async (req, { tenantId }) => {
  const { key, kind } = await parseBody(req, brandingUploadSchema);

  try {
    assertKeyInFolder(key, uploadFolder(kind, tenantId));
  } catch (err) {
    if (err instanceof UploadValidationError) {
      throw new ApiError(err.message, err.status);
    }
    throw err;
  }

  return NextResponse.json({ url: publicUrlForKey(key) });
});
