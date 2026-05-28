import { NextResponse } from "next/server";
import { withTenant } from "@/lib/api";
import {
  IMAGE_MIMES,
  MB,
  UploadValidationError,
  uploadToBlob,
} from "@/lib/blob";
import { UPLOAD_KINDS, type UploadKind } from "@/lib/schemas";

/** Limites por tipo — logo é menor (otimização de bandwidth no rodapé). */
const LIMITS: Record<UploadKind, number> = {
  logo: 4 * MB,
  hero: 8 * MB,
};

const UPLOAD_OPTIONS = (kind: UploadKind) =>
  ({
    allowedMimes: IMAGE_MIMES,
    maxBytes: LIMITS[kind],
  }) as const;

/**
 * Upload de imagens de identidade visual (logo, hero) — scope tenant.
 * Recebe FormData com `file` + `kind`. Devolve `{ url }` pra o client
 * persistir via PATCH /api/personalizar (logo_url ou layout_config.heroImageUrl).
 *
 * Cleanup de URLs antigas fica por conta do usuário trocar e salvar — o
 * endpoint não tem contexto pra saber qual era a anterior. Em prod isso
 * gera alguns blobs órfãos quando o usuário troca várias vezes sem salvar;
 * aceitável pra v1.
 */
export const POST = withTenant(async (req, { tenantId }) => {
  const formData = await req.formData();
  const file = formData.get("file");
  const kind = formData.get("kind");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
  }
  if (typeof kind !== "string" || !UPLOAD_KINDS.includes(kind as UploadKind)) {
    return NextResponse.json(
      { error: `Tipo inválido. Use: ${UPLOAD_KINDS.join(", ")}.` },
      { status: 400 },
    );
  }

  try {
    const url = await uploadToBlob(
      file,
      `tenants/${tenantId}/branding/${kind}`,
      UPLOAD_OPTIONS(kind as UploadKind),
    );
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});
