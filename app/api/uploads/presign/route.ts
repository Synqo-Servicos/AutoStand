import { NextResponse } from "next/server";
import { ApiError, parseBody, withTenant } from "@/lib/api";
import { getPhotosByVehicle, getVehicle } from "@/lib/db";
import { MAX_PHOTOS_PER_VEHICLE, UploadValidationError } from "@/lib/blob-constants";
import {
  buildUploadKey,
  publicUrlForKey,
  validatePresignInput,
} from "@/lib/presign";
import { CDN_URL, HAS_S3, presignPut } from "@/lib/s3";
import { presignRequestSchema } from "@/lib/validation";

/**
 * Emite uma URL assinada pro browser subir o arquivo DIRETO no S3.
 *
 * Por quê: na Vercel o body de uma function estoura em 4,5MB e o 413 vem da
 * borda, antes do handler — nenhum tratamento nosso roda. Tirando o arquivo do
 * body, o limite deixa de existir e os limites reais voltam a ser os do
 * produto (8MB foto, 20MB documento).
 *
 * Esta rota é a última fronteira de confiança do fluxo. Depois dela o cliente
 * fala direto com a AWS, então tudo que importa é decidido aqui:
 *  - sessão de tenant (withTenant)
 *  - MIME e tamanho dentro da regra do `kind` — e FIXADOS na assinatura
 *  - veículo pertence ao tenant (mesma guarda das rotas de persistência)
 *  - a `key` é gerada aqui, a partir do tenant da sessão: o cliente nunca
 *    escolhe onde escreve
 *
 * O cliente devolve a `key` pra rota de persistência, que a revalida contra a
 * pasta esperada — a URL pública é sempre derivada no servidor.
 */
export const POST = withTenant(async (req, { tenantId }) => {
  const body = await parseBody(req, presignRequestSchema);

  let plan;
  try {
    plan = validatePresignInput(body, tenantId);
  } catch (err) {
    if (err instanceof UploadValidationError) {
      throw new ApiError(err.message, err.status);
    }
    throw err;
  }

  // Uploads de veículo: ownership antes de assinar. Sem isto, um admin
  // conseguiria assinar writes em `tenants/<seu>/vehicles/<id alheio>` —
  // não vaza dado, mas suja o bucket e a FK.
  if (body.vehicleId !== undefined) {
    if (!(await getVehicle(tenantId, body.vehicleId))) {
      throw new ApiError("Not found", 404);
    }

    // O limite de fotos precisa valer ANTES do upload: como o arquivo não
    // passa mais pelo servidor, checar só na persistência deixaria o blob
    // já pago e órfão no bucket.
    if (body.kind === "photo") {
      const existing = await getPhotosByVehicle(tenantId, body.vehicleId);
      if (existing.length >= MAX_PHOTOS_PER_VEHICLE) {
        throw new ApiError(
          `Limite de ${MAX_PHOTOS_PER_VEHICLE} fotos por veículo atingido.`,
          413,
        );
      }
    }
  }

  const key = buildUploadKey(plan.folder, plan.ext);

  // Dev sem S3: o PUT vai pro stub local, com a MESMA key — o cliente não
  // sabe a diferença. Em produção sem bucket, presignPut falharia de forma
  // obscura; melhor errar aqui, explícito.
  if (!HAS_S3) {
    if (process.env.NODE_ENV === "production") {
      throw new ApiError("Storage não configurado (AWS_S3_BUCKET ausente).", 503);
    }
    return NextResponse.json({
      uploadUrl: `/api/uploads/dev?key=${encodeURIComponent(key)}`,
      key,
      publicUrl: publicUrlForKey(key, CDN_URL),
      headers: { "Content-Type": plan.mime },
    });
  }

  const uploadUrl = await presignPut(key, plan.mime, body.size);

  return NextResponse.json({
    uploadUrl,
    key,
    publicUrl: publicUrlForKey(key, CDN_URL),
    // O PUT tem que repetir exatamente estes headers — eles estão na
    // assinatura. Devolver prontos evita o cliente adivinhar.
    headers: { "Content-Type": plan.mime },
  });
});
