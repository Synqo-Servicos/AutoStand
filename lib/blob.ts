import "server-only";
import { put, del } from "@vercel/blob";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

// Re-exporta as constantes pra não obrigar caller de servidor a saber
// de qual módulo vem cada coisa.
export {
  IMAGE_MIMES, DOC_MIMES, MB,
  PHOTO_MAX_BYTES, DOC_MAX_BYTES, MAX_PHOTOS_PER_VEHICLE,
  type AllowedMime,
} from "./blob-constants";

/**
 * Validação + persistência de upload — server-only. Defesa contra
 * arquivos maliciosos, abuso de CDN pública e blob bombs:
 *
 *  1) MIME declarado (file.type) está na allowlist
 *  2) Tamanho ≤ maxBytes (chega 2x — antes e depois de ler o buffer,
 *     já que file.size pode ter sido falsificado por proxy)
 *  3) Magic bytes do conteúdo batem com um MIME da allowlist
 *  4) MIME declarado bate com o detectado (proteção extra)
 *
 * Storage:
 *  - Em prod (Vercel) com BLOB_READ_WRITE_TOKEN setado: @vercel/blob
 *  - Em dev sem token: filesystem stub em public/uploads/dev/
 *    (Next serve /public direto)
 */

/** Assinaturas (offset 0). WebP precisa de um check extra no offset 8. */
const MAGIC_BYTES: Record<string, number[][]> = {
  "image/jpeg":      [[0xff, 0xd8, 0xff]],
  "image/png":       [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/webp":      [[0x52, 0x49, 0x46, 0x46]], // RIFF (+ "WEBP" @ offset 8)
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
};

/** Extensão segura por MIME (ignoramos a do nome enviado pelo cliente). */
const SAFE_EXT: Record<string, string> = {
  "image/jpeg":      "jpg",
  "image/png":       "png",
  "image/webp":      "webp",
  "application/pdf": "pdf",
};

export class UploadValidationError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message);
    this.name = "UploadValidationError";
  }
}

export interface UploadOptions {
  /** MIME types aceitos para este upload (subset de IMAGE_MIMES/DOC_MIMES). */
  allowedMimes: readonly string[];
  /** Limite em bytes. Recomendado: 8MB foto, 20MB documento. */
  maxBytes: number;
}

function matches(buf: Buffer, signature: number[]): boolean {
  if (buf.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buf[i] !== signature[i]) return false;
  }
  return true;
}

function detectMime(buf: Buffer): string | null {
  for (const [mime, signatures] of Object.entries(MAGIC_BYTES)) {
    for (const sig of signatures) {
      if (!matches(buf, sig)) continue;
      // RIFF é compartilhado por WebP/AVI/WAV — confirma "WEBP" @ offset 8.
      if (mime === "image/webp") {
        if (buf.length < 12) continue;
        if (buf.subarray(8, 12).toString("ascii") !== "WEBP") continue;
      }
      return mime;
    }
  }
  return null;
}

function formatLimit(bytes: number): string {
  const MB = 1024 * 1024;
  const mb = bytes / MB;
  return mb >= 1 ? `${mb.toFixed(0)}MB` : `${Math.ceil(bytes / 1024)}KB`;
}

async function validateUpload(
  file: File,
  opts: UploadOptions,
): Promise<{ buffer: Buffer; mime: string; ext: string }> {
  if (!file.type || !opts.allowedMimes.includes(file.type)) {
    throw new UploadValidationError(
      `Tipo de arquivo não permitido${file.type ? `: ${file.type}` : ""}.`,
    );
  }
  if (file.size > opts.maxBytes) {
    throw new UploadValidationError(
      `Arquivo maior que o limite (${formatLimit(opts.maxBytes)}).`,
      413,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > opts.maxBytes) {
    throw new UploadValidationError(
      `Arquivo maior que o limite (${formatLimit(opts.maxBytes)}).`,
      413,
    );
  }

  const detected = detectMime(buffer);
  if (!detected || !opts.allowedMimes.includes(detected)) {
    throw new UploadValidationError(
      "Conteúdo do arquivo não corresponde a um tipo permitido.",
    );
  }
  if (detected !== file.type) {
    throw new UploadValidationError(
      "Tipo declarado não bate com o conteúdo do arquivo.",
    );
  }

  return { buffer, mime: detected, ext: SAFE_EXT[detected] ?? "bin" };
}

// — Storage backend ———————————————————————————————————————————————

const HAS_BLOB_TOKEN = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
const IS_PROD = process.env.NODE_ENV === "production";

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "dev");
const LOCAL_URL_PREFIX = "/uploads/dev";

async function putLocal(buffer: Buffer, folder: string, ext: string): Promise<string> {
  const dir = path.join(LOCAL_UPLOAD_DIR, folder);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  await writeFile(path.join(dir, filename), buffer);
  return `${LOCAL_URL_PREFIX}/${folder}/${filename}`;
}

async function delLocal(url: string): Promise<void> {
  if (!url.startsWith(LOCAL_URL_PREFIX + "/")) return;
  const rel = url.slice(LOCAL_URL_PREFIX.length + 1);
  const full = path.join(LOCAL_UPLOAD_DIR, rel);
  try {
    await unlink(full);
  } catch {
    // Idempotente — arquivo já não existe.
  }
}

/**
 * Sobe um arquivo respeitando as regras do `options`. Server-only.
 * Lança UploadValidationError em qualquer falha de validação.
 */
export async function uploadToBlob(
  file: File,
  folder: string,
  options: UploadOptions,
): Promise<string> {
  const { buffer, mime, ext } = await validateUpload(file, options);

  if (HAS_BLOB_TOKEN) {
    const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const blob = await put(filename, buffer, { access: "public", contentType: mime });
    return blob.url;
  }

  if (IS_PROD) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN ausente em produção — configure o Vercel Blob.",
    );
  }

  return putLocal(buffer, folder, ext);
}

/** Detecta URLs servidas pelo Vercel Blob — só essas podem ser deletadas
 *  via @vercel/blob. Evita errors quando o caller passa URL externa
 *  (Unsplash, CDN colada por super-admin, etc) que não é nossa. */
function isVercelBlobUrl(url: string): boolean {
  return url.includes(".public.blob.vercel-storage.com");
}

export async function deleteFromBlob(url: string): Promise<void> {
  if (url.startsWith(LOCAL_URL_PREFIX + "/")) return delLocal(url);
  if (HAS_BLOB_TOKEN && isVercelBlobUrl(url)) {
    await del(url);
  }
  // URL externa ou sem token: best-effort silencioso.
}
