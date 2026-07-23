/**
 * Núcleo do upload direto pro S3 — puro, sem `server-only` e sem AWS SDK,
 * pra ser testável e importável de qualquer contexto de servidor.
 *
 * Por que existe: na Vercel o body de uma function morre em 4,5MB, na borda,
 * antes do handler rodar (413 FUNCTION_PAYLOAD_TOO_LARGE) — nenhum try/catch
 * nosso salva. Então o arquivo deixou de passar pelo servidor: o browser faz
 * PUT direto no bucket com uma URL assinada e depois só manda a `key`.
 *
 * Consequência: o servidor nunca vê os bytes. Some a checagem de magic bytes
 * que lib/blob.ts fazia. O que resta de defesa (e por isso é levado a sério
 * aqui) é a própria assinatura, que fixa Content-Type e Content-Length: o
 * objeto que aterrissa no bucket tem obrigatoriamente o MIME da allowlist e o
 * tamanho declarado. Como o CDN serve com esse Content-Type, um payload
 * disfarçado não executa — nenhum MIME ativo (svg, html) está na allowlist.
 *
 * A key é SEMPRE gerada aqui, a partir do tenant da sessão. O cliente nunca
 * escolhe onde escreve.
 */

import {
  EXT_BY_MIME,
  SAFE_EXTS,
  UPLOAD_RULES,
  UploadValidationError,
  formatLimit,
  type PresignKind,
} from "./blob-constants";

/** Stub de dev sem S3 — Next serve /public direto. Espelha lib/blob.ts. */
export const LOCAL_URL_PREFIX = "/uploads/dev";

export interface PresignInput {
  kind: PresignKind;
  contentType: string;
  size: number;
  vehicleId?: number;
}

export interface PresignPlan {
  mime: string;
  ext: string;
  folder: string;
  maxBytes: number;
}

/**
 * Pasta de destino — MESMA convenção do `uploadToBlob` original. As URLs já
 * gravadas no banco dependem dela (keyFromCdnUrl / s3Delete fazem o caminho
 * de volta), então mudar aqui quebra deleção de tudo que já existe.
 */
export function uploadFolder(
  kind: PresignKind,
  tenantId: number,
  vehicleId?: number,
): string {
  if (UPLOAD_RULES[kind].needsVehicle && !vehicleId) {
    throw new UploadValidationError("vehicleId é obrigatório para este tipo de upload.");
  }
  switch (kind) {
    case "photo":
      return `tenants/${tenantId}/vehicles/${vehicleId}`;
    case "document":
      return `tenants/${tenantId}/vehicles/${vehicleId}/docs`;
    case "logo":
    case "hero":
      return `tenants/${tenantId}/branding/${kind}`;
  }
}

/** Valida MIME + tamanho contra a regra do `kind`. Lança UploadValidationError. */
export function validatePresignInput(
  input: PresignInput,
  tenantId: number,
): PresignPlan {
  const rule = UPLOAD_RULES[input.kind];
  if (!rule) {
    throw new UploadValidationError(`Tipo de upload inválido: ${input.kind}.`);
  }

  if (!input.contentType || !rule.allowedMimes.includes(input.contentType)) {
    throw new UploadValidationError(
      `Tipo de arquivo não permitido${input.contentType ? `: ${input.contentType}` : ""}.`,
    );
  }

  if (!Number.isInteger(input.size) || input.size <= 0) {
    throw new UploadValidationError("Tamanho de arquivo inválido.");
  }
  if (input.size > rule.maxBytes) {
    throw new UploadValidationError(
      `Arquivo maior que o limite (${formatLimit(rule.maxBytes)}).`,
      413,
    );
  }

  return {
    mime: input.contentType,
    ext: EXT_BY_MIME[input.contentType],
    folder: uploadFolder(input.kind, tenantId, input.vehicleId),
    maxBytes: rule.maxBytes,
  };
}

/** `{folder}/{timestamp}-{rand}.{ext}` — convenção herdada de lib/blob.ts. */
export function buildUploadKey(folder: string, ext: string): string {
  return `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
}

/** URL pública. Sem CDN (dev sem S3), cai no stub servido por /public. */
export function publicUrlForKey(key: string, cdnUrl: string): string {
  const base = cdnUrl.replace(/\/$/, "");
  return base ? `${base}/${key}` : `${LOCAL_URL_PREFIX}/${key}`;
}

const KEY_BASENAME = new RegExp(`^\\d+-[a-z0-9]+\\.(${SAFE_EXTS.join("|")})$`);

/**
 * Guard das rotas de persistência: a `key` que o cliente devolve tem que ser
 * exatamente uma que ESTE servidor assinou pra ESTA pasta. Sem isso, um admin
 * de loja mandaria a key de outra loja e gravaria a URL dela no próprio banco
 * (e depois apagaria o blob alheio via DELETE, que confia no que está no banco).
 *
 * Confere prefixo exato + basename no formato gerado por buildUploadKey — o
 * que também mata path traversal (`../`) e extensão fora da allowlist.
 */
export function assertKeyInFolder(key: string, folder: string): void {
  const prefix = `${folder}/`;
  const invalid = () =>
    new UploadValidationError("Referência de arquivo inválida para este destino.", 400);

  if (typeof key !== "string" || !key.startsWith(prefix)) throw invalid();
  const basename = key.slice(prefix.length);
  if (!KEY_BASENAME.test(basename)) throw invalid();
}
