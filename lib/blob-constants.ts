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
export const MAX_PHOTOS_PER_VEHICLE = 15;
