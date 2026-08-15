import { NextResponse } from "next/server";
import { ApiError, withSuperAdmin } from "@/lib/api";
import { deleteFromBlob } from "@/lib/blob";
import { ownsBlobUrl } from "@/lib/blob-ownership";
import { deleteTenant, getTenantById, listTenantBlobRefs, updateTenant } from "@/lib/db";

export const GET = withSuperAdmin<{ id: string }>(async (_req, { params }) => {
  const tenant = await getTenantById(Number(params.id));
  if (!tenant) throw new ApiError("Not found", 404);
  return NextResponse.json(tenant);
});

export const PATCH = withSuperAdmin<{ id: string }>(async (req, { params }) => {
  const body = await req.json();
  const tenant = await updateTenant(Number(params.id), body);
  if (!tenant) throw new ApiError("Not found", 404);
  return NextResponse.json(tenant);
});

export const DELETE = withSuperAdmin<{ id: string }>(async (_req, { params }) => {
  const id = Number(params.id);
  // Snapshot dos blobs ANTES do delete — depois da remoção em cascata
  // o tenant_id volta zero linhas. Cleanup é best-effort: falhas no
  // storage não revertem o delete do DB.
  const blobRefs = await listTenantBlobRefs(id);
  await deleteTenant(id);

  // SEGURANÇA (cross-tenant): a URL vem do banco, e dado no banco não é prova
  // de posse. O código de branding corrigido em 1b04c4b aceitava do cliente a
  // URL do arquivo de OUTRA loja em `logo_url`/`heroImageUrl`; onde isso já
  // aconteceu, a linha continua envenenada. Excluir a Loja A varreria o bucket
  // apagando o logo da Loja B junto — o mesmo estrago, por outra porta.
  // Então só apagamos o objeto cuja key está PROVADAMENTE na pasta deste
  // tenant. O que não passa fica no bucket: no pior caso é um órfão nosso
  // (custo de storage), enquanto o inverso é destruição de arquivo alheio.
  // URL externa (o seed usa Unsplash no hero) também não passa, e não é erro:
  // não é objeto nosso pra deletar.
  const deletable = blobRefs.filter((b) => ownsBlobUrl(b.url, b.folder));
  await Promise.allSettled(deletable.map((b) => deleteFromBlob(b.url)));
  return NextResponse.json({ ok: true });
});
