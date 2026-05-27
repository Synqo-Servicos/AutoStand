import { put, del } from "@vercel/blob";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Validação de upload — defesa contra arquivos maliciosos, abuso de CDN
 * pública e blob bombs:
 *
 *  1) MIME declarado (file.type) está na allowlist
 *  2) Tamanho ≤ maxBytes (chega 2x — antes e depois de ler o buffer,
 *     já que file.size pode ter sido falsificado por proxy)
 *  3) Magic bytes do conteúdo batem com um MIME da allowlist
 *  4) MIME declarado bate com o detectado (proteção extra)
 *
 * Storage:
 *  - Em prod (Vercel) com BLOB_READ_WRITE_TOKEN setado: usa @vercel/blob
 *  - Em dev sem token: cai num stub de filesystem que grava em
 *    public/uploads/dev/ — Next.js serve /public automaticamente, então
 *    os URLs `/uploads/dev/<...>` resolvem direto
 */

// Tipos suportados. Adicionar uma linha aqui não é suficiente:
// precisa de magic bytes correspondente em MAGIC_BYTES.
export const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export const DOC_MIMES = [
  ...IMAGE_MIMES,
  "application/pdf",
] as const;
export type AllowedMime =
  | (typeof IMAGE_MIMES)[number]
  | (typeof DOC_MIMES)[number];

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

export const MB = 1024 * 1024;

/** Limites de upload reaproveitados no client + servidor. */
export const PHOTO_MAX_BYTES = 8 * MB;
export const DOC_MAX_BYTES = 20 * MB;
export const MAX_PHOTOS_PER_VEHICLE = 15;

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
  const mb = bytes / MB;
  return mb >= 1 ? `${mb.toFixed(0)}MB` : `${Math.ceil(bytes / 1024)}KB`;
}

async function validateUpload(
  file: File,
  opts: UploadOptions,
): Promise<{ buffer: Buffer; mime: string; ext: string }> {
  // 1) Tipo declarado — barra cedo, antes de ler o arquivo.
  if (!file.type || !opts.allowedMimes.includes(file.type)) {
    throw new UploadValidationError(
      `Tipo de arquivo não permitido${file.type ? `: ${file.type}` : ""}.`,
    );
  }

  // 2) Tamanho declarado.
  if (file.size > opts.maxBytes) {
    throw new UploadValidationError(
      `Arquivo maior que o limite (${formatLimit(opts.maxBytes)}).`,
      413,
    );
  }

  // 3) Lê e re-confere tamanho real (file.size pode mentir).
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > opts.maxBytes) {
    throw new UploadValidationError(
      `Arquivo maior que o limite (${formatLimit(opts.maxBytes)}).`,
      413,
    );
  }

  // 4) Magic bytes — bloqueia HTML/SVG/JS disfarçados com extensão de imagem.
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

// — Storage backend: Vercel Blob (prod) ou filesystem local (dev) ———

const HAS_BLOB_TOKEN = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
const IS_PROD = process.env.NODE_ENV === "production";

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "dev");
const LOCAL_URL_PREFIX = "/uploads/dev";

async function putLocal(
  buffer: Buffer,
  folder: string,
  ext: string,
  mime: string,
): Promise<string> {
  void mime; // o tipo já vem no header da response do Next pela extensão
  const dir = path.join(LOCAL_UPLOAD_DIR, folder);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  await writeFile(path.join(dir, filename), buffer);
  return `${LOCAL_URL_PREFIX}/${folder}/${filename}`;
}

async function delLocal(url: string): Promise<void> {
  // URL local começa com /uploads/dev/...; converte pro caminho no disco.
  if (!url.startsWith(LOCAL_URL_PREFIX + "/")) return;
  const rel = url.slice(LOCAL_URL_PREFIX.length + 1);
  const full = path.join(LOCAL_UPLOAD_DIR, rel);
  try {
    await unlink(full);
  } catch {
    // Arquivo já não existe — operação idempotente.
  }
}

/**
 * Sobe um arquivo respeitando as regras do `options`. Em prod (Vercel
 * Blob) ou em dev (filesystem stub) — escolha do storage é transparente
 * pro caller.
 *
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
    const blob = await put(filename, buffer, {
      access: "public",
      contentType: mime,
    });
    return blob.url;
  }

  if (IS_PROD) {
    // Em produção sem token, é melhor falhar alto do que cair num stub
    // que grava no FS efêmero da Vercel e desaparece no próximo deploy.
    throw new Error(
      "BLOB_READ_WRITE_TOKEN ausente em produção — configure o Vercel Blob.",
    );
  }

  return putLocal(buffer, folder, ext, mime);
}

export async function deleteFromBlob(url: string): Promise<void> {
  if (url.startsWith(LOCAL_URL_PREFIX + "/")) {
    return delLocal(url);
  }
  if (HAS_BLOB_TOKEN) {
    await del(url);
    return;
  }
  // URL é remota mas não temos token — ignora silenciosamente (já
  // estava lá antes do token sumir). Caller decide se quer logar.
}
