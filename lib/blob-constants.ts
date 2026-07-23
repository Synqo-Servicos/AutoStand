/**
 * Constantes e enums de upload — seguros para importar em client
 * components. Quem precisa fazer upload de fato (validação +
 * persistência) importa de lib/blob.ts, que é server-only.
 */

export const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export const DOC_MIMES = [
  ...IMAGE_MIMES,
  "application/pdf",
] as const;
export type AllowedMime =
  | (typeof IMAGE_MIMES)[number]
  | (typeof DOC_MIMES)[number];

export const MB = 1024 * 1024;

/** Limites compartilhados entre client (pre-flight) e servidor (autoritativo). */
export const PHOTO_MAX_BYTES = 8 * MB;
export const DOC_MAX_BYTES = 20 * MB;
/** Hero é imagem de capa (grande). Logo é pequena — bandwidth no rodapé. */
export const HERO_MAX_BYTES = 8 * MB;
export const LOGO_MAX_BYTES = 4 * MB;
export const MAX_PHOTOS_PER_VEHICLE = 15;

/** Extensão segura por MIME (ignoramos a do nome enviado pelo cliente). */
export const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Extensões que uma key nossa pode ter — usado pra validar key vinda do client. */
export const SAFE_EXTS = Object.values(EXT_BY_MIME);

/**
 * Tipos de upload aceitos pelo presign. Cada um tem allowlist de MIME e
 * limite próprios — a assinatura fixa os dois, então isto É a validação.
 */
export const PRESIGN_KINDS = ["photo", "document", "logo", "hero"] as const;
export type PresignKind = (typeof PRESIGN_KINDS)[number];

export interface UploadRule {
  allowedMimes: readonly string[];
  maxBytes: number;
  /** Uploads de veículo exigem `vehicleId` (e ownership check na rota). */
  needsVehicle: boolean;
}

export const UPLOAD_RULES: Record<PresignKind, UploadRule> = {
  photo:    { allowedMimes: IMAGE_MIMES, maxBytes: PHOTO_MAX_BYTES, needsVehicle: true },
  document: { allowedMimes: DOC_MIMES,   maxBytes: DOC_MAX_BYTES,   needsVehicle: true },
  logo:     { allowedMimes: IMAGE_MIMES, maxBytes: LOGO_MAX_BYTES,  needsVehicle: false },
  hero:     { allowedMimes: IMAGE_MIMES, maxBytes: HERO_MAX_BYTES,  needsVehicle: false },
};

/**
 * Erro de validação de upload. Vive aqui (e não em blob.ts) pra ser
 * lançável também pelo módulo puro de presign, sem arrastar `server-only`.
 * blob.ts re-exporta — imports antigos seguem funcionando.
 */
export class UploadValidationError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message);
    this.name = "UploadValidationError";
  }
}

export function formatLimit(bytes: number): string {
  const mb = bytes / MB;
  return mb >= 1 ? `${mb.toFixed(0)}MB` : `${Math.ceil(bytes / 1024)}KB`;
}
