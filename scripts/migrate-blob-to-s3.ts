// scripts/migrate-blob-to-s3.ts
// Migra todos os blobs do Vercel Blob para S3.
// Uso: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... AWS_S3_BUCKET=... CDN_URL=... npx tsx scripts/migrate-blob-to-s3.ts
import { createClient } from "@libsql/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { drizzle } from "drizzle-orm/libsql";
import { tenants, vehicle_photos, vehicle_documents } from "../lib/schema";
import { eq, like } from "drizzle-orm";

const VERCEL_BLOB_PATTERN = ".public.blob.vercel-storage.com";
const CDN_URL = (process.env.CDN_URL ?? "https://cdn.autostand.com.br").replace(/\/$/, "");
const BUCKET = process.env.AWS_S3_BUCKET ?? "";
const REGION = process.env.AWS_S3_REGION ?? "sa-east-1";

if (!BUCKET) {
  console.error("AWS_S3_BUCKET não definido");
  process.exit(1);
}

const s3 = new S3Client({ region: REGION });
const libsql = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(libsql);

async function migrateUrl(url: string, key: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar ${url}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType }));
  return `${CDN_URL}/${key}`;
}

function keyFromVercelUrl(url: string, folder: string): string {
  const filename = url.split("/").pop() ?? `file-${Date.now()}`;
  return `${folder}/${filename}`;
}

async function main() {
  console.log("Iniciando migração Vercel Blob → S3...\n");
  let migrated = 0;
  let errors = 0;

  // Logos + heroImageUrl dos tenants
  const allTenants = await db.select({
    id: tenants.id,
    logo_url: tenants.logo_url,
    layout_config: tenants.layout_config,
  }).from(tenants).all();

  for (const tenant of allTenants) {
    if (tenant.logo_url?.includes(VERCEL_BLOB_PATTERN)) {
      try {
        const key = keyFromVercelUrl(tenant.logo_url, `tenants/${tenant.id}/logo`);
        const newUrl = await migrateUrl(tenant.logo_url, key);
        await db.update(tenants).set({ logo_url: newUrl }).where(eq(tenants.id, tenant.id));
        console.log(`✓ tenant ${tenant.id} logo_url`);
        migrated++;
      } catch (e) {
        console.error(`✗ tenant ${tenant.id} logo_url:`, e);
        errors++;
      }
    }

    const layout = tenant.layout_config as Record<string, unknown> | null;
    const heroUrl = layout?.heroImageUrl as string | undefined;
    if (heroUrl?.includes(VERCEL_BLOB_PATTERN)) {
      try {
        const key = keyFromVercelUrl(heroUrl, `tenants/${tenant.id}/hero`);
        const newUrl = await migrateUrl(heroUrl, key);
        await db.update(tenants)
          .set({ layout_config: { ...layout, heroImageUrl: newUrl } as typeof tenants.$inferInsert["layout_config"] })
          .where(eq(tenants.id, tenant.id));
        console.log(`✓ tenant ${tenant.id} heroImageUrl`);
        migrated++;
      } catch (e) {
        console.error(`✗ tenant ${tenant.id} heroImageUrl:`, e);
        errors++;
      }
    }
  }

  // Fotos de veículos
  const photos = await db.select().from(vehicle_photos)
    .where(like(vehicle_photos.url, `%${VERCEL_BLOB_PATTERN}%`)).all();

  for (const photo of photos) {
    try {
      const key = keyFromVercelUrl(photo.url, `tenants/${photo.tenant_id}/vehicles/${photo.vehicle_id}/photos`);
      const newUrl = await migrateUrl(photo.url, key);
      await db.update(vehicle_photos).set({ url: newUrl }).where(eq(vehicle_photos.id, photo.id));
      console.log(`✓ photo ${photo.id}`);
      migrated++;
    } catch (e) {
      console.error(`✗ photo ${photo.id}:`, e);
      errors++;
    }
  }

  // Documentos de veículos
  const docs = await db.select().from(vehicle_documents)
    .where(like(vehicle_documents.url, `%${VERCEL_BLOB_PATTERN}%`)).all();

  for (const doc of docs) {
    try {
      const key = keyFromVercelUrl(doc.url, `tenants/${doc.tenant_id}/vehicles/${doc.vehicle_id}/docs`);
      const newUrl = await migrateUrl(doc.url, key);
      await db.update(vehicle_documents).set({ url: newUrl }).where(eq(vehicle_documents.id, doc.id));
      console.log(`✓ doc ${doc.id}`);
      migrated++;
    } catch (e) {
      console.error(`✗ doc ${doc.id}:`, e);
      errors++;
    }
  }

  console.log(`\nConcluído: ${migrated} migrados, ${errors} erros`);
  process.exit(errors > 0 ? 1 : 0);
}

main();
