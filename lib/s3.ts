import "server-only";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

export const s3 = new S3Client({ region: process.env.AWS_S3_REGION ?? "sa-east-1" });

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

/** Extrai a key S3 de uma URL do CDN. Retorna null se não for nossa URL. */
export function keyFromCdnUrl(url: string): string | null {
  if (!CDN_URL || !url.startsWith(CDN_URL + "/")) return null;
  return url.slice(CDN_URL.length + 1);
}

export const HAS_S3 = Boolean(BUCKET);
