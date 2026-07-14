import "server-only";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Credentials } from "./s3-credentials";

// Região: `AWS_S3_REGION`, nunca `AWS_REGION` — o Vercel sobrescreve essa
// última com a região de execução da function, que é instável.
export const s3 = new S3Client({
  region: process.env.AWS_S3_REGION ?? "sa-east-1",
  credentials: s3Credentials(),
});

export const BUCKET = process.env.AWS_S3_BUCKET ?? "";

/** URL pública via CloudFront. Configurar CDN_URL=https://cdn.autostand.com.br */
export const CDN_URL = (process.env.CDN_URL ?? "").replace(/\/$/, "");

export async function s3Put(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
  return `${CDN_URL}/${key}`;
}

export async function s3Delete(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** Janela curta: a URL assinada só serve pro PUT que o cliente já vai disparar. */
const PRESIGN_EXPIRES_SECONDS = 60;

/**
 * URL assinada pra um PUT único. `ContentType` e `ContentLength` entram na
 * assinatura (via `signableHeaders`), então a URL só aceita ESTE arquivo:
 * outro MIME ou outro tamanho → SignatureDoesNotMatch. Sem isso, a URL seria
 * um write arbitrário no bucket público durante a janela de validade.
 *
 * O S3RequestPresigner marca `content-type` como unsignable por padrão;
 * `signableHeaders` tem precedência sobre essa lista e força a assinatura.
 * O browser manda Content-Length sozinho (body de tamanho conhecido) e o
 * Content-Type nós devolvemos pro cliente ecoar.
 */
export async function presignPut(
  key: string,
  contentType: string,
  size: number,
): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    }),
    {
      expiresIn: PRESIGN_EXPIRES_SECONDS,
      signableHeaders: new Set(["content-type", "content-length"]),
    },
  );
}

/** Extrai a key S3 de uma URL do CDN. Retorna null se não for nossa URL. */
export function keyFromCdnUrl(url: string): string | null {
  if (!CDN_URL || !url.startsWith(CDN_URL + "/")) return null;
  return url.slice(CDN_URL.length + 1);
}

export const HAS_S3 = Boolean(BUCKET);
