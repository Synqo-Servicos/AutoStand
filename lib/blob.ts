import "server-only";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { s3Delete, keyFromCdnUrl, CDN_URL, HAS_S3 } from "./s3";
import { LOCAL_URL_PREFIX, publicUrlForKey as buildPublicUrl } from "./presign";
import { existsSync } from "node:fs";
import path from "node:path";

// Re-exporta as constantes pra não obrigar caller de servidor a saber
// de qual módulo vem cada coisa.
export {
  IMAGE_MIMES, DOC_MIMES, MB,
  PHOTO_MAX_BYTES, DOC_MAX_BYTES, MAX_PHOTOS_PER_VEHICLE,
  UploadValidationError,
  type AllowedMime,
} from "./blob-constants";

/**
 * Persistência de blobs — server-only.
 *
 * O arquivo NÃO passa mais por aqui. Desde a migração pra Vercel, o browser
 * faz PUT direto no S3 com URL assinada (lib/presign.ts + /api/uploads/presign)
 * — o body de uma function morre em 4,5MB, na borda, antes do handler. Este
 * módulo cuida do que sobrou do lado do servidor: resolver a URL pública de
 * uma key e apagar blobs.
 *
 * Storage:
 *  - Com S3 (HAS_S3): bucket via URL assinada; delete via s3Delete
 *  - Dev sem S3: stub em public/uploads/dev/ (Next serve /public direto),
 *    alimentado pelo PUT de /api/uploads/dev — mesmo contrato de cliente,
 *    então o fluxo de dev é o mesmo de produção.
 */

const IS_PROD = process.env.NODE_ENV === "production";

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "dev");

/** URL pública de uma key. Única fonte da verdade — o cliente nunca a escolhe. */
export function publicUrlForKey(key: string): string {
  return buildPublicUrl(key, CDN_URL);
}

/**
 * Escreve o objeto no stub local, na key exata que o presign devolveu (dev
 * sem S3). Em produção nunca roda: sem bucket, o presign já falha antes.
 */
export async function writeLocalObject(key: string, buffer: Buffer): Promise<void> {
  if (IS_PROD) {
    throw new Error("AWS_S3_BUCKET ausente em produção — configure o S3.");
  }
  const full = path.join(LOCAL_UPLOAD_DIR, key);
  // `key` é sempre gerada pelo servidor (buildUploadKey) e revalidada pela
  // rota, mas confinar no diretório é barato e fecha traversal de vez.
  if (!full.startsWith(LOCAL_UPLOAD_DIR + path.sep)) {
    throw new Error("Key inválida.");
  }
  const dir = path.dirname(full);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(full, buffer);
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

export async function deleteFromBlob(url: string): Promise<void> {
  if (url.startsWith(LOCAL_URL_PREFIX + "/")) return delLocal(url);

  const key = keyFromCdnUrl(url);
  if (HAS_S3 && key) {
    await s3Delete(key);
  }
  // URL externa ou sem S3: best-effort silencioso.
}
