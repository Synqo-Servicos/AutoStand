import { NextResponse } from "next/server";
import { ApiError, withTenant } from "@/lib/api";
import { BANKS_BY_SLUG } from "@/lib/banks";
import { deleteFromBlob, publicUrlForKey } from "@/lib/blob";
import { UploadValidationError } from "@/lib/blob-constants";
import { ownKeyFromUrl, ownsBlobUrl } from "@/lib/blob-ownership";
import { getTenantById, updateTenant } from "@/lib/db";
import { capabilitiesFor } from "@/lib/plans";
import { assertKeyInFolder, uploadFolder } from "@/lib/presign";
import { resolveLayoutConfig, sanitizeLayoutConfig } from "@/lib/layout";
import { tenantStorefrontSchema, type UploadKind } from "@/lib/validation";
import type { NewTenant } from "@/lib/schema";

/**
 * Personalização self-service — o `tenant_admin` atualiza a aparência do
 * próprio site. Campos da identidade (cores, hero, sobre, CTA, contato,
 * endereço, redes sociais, logo) passam por `tenantStorefrontSchema`;
 * layout (`layout_config`) só é gravado se o plano tiver a capability
 * `layoutConfig`; `partner_banks` é validado contra o catálogo mestre.
 *
 * SEGURANÇA (cross-tenant): `logo_url` e `layout_config.heroImageUrl` são
 * referências de arquivo vindas do cliente, e o cleanup de órfãos no fim do
 * handler chama `deleteFromBlob` na referência ANTIGA. Sem prova de posse,
 * dois PATCHes apagariam do bucket o logo/hero/foto de OUTRA loja (as URLs
 * saem no HTML público da vitrine): o 1º grava a URL alheia, o 2º a troca e
 * o cleanup a apaga. É a mesma classe de falha que os anexos de contas a
 * pagar corrigiram em c72b3f8 (`url` → `key` + `assertKeyInFolder`), aqui
 * propagada pro branding, com duas barreiras independentes:
 *
 *  1. escrita — `resolveBrandingRef` só aceita key/URL da pasta
 *     `tenants/{tenantId}/branding/{kind}` deste tenant (ou uma URL externa,
 *     que não é objeto nosso e portanto nunca é deletável);
 *  2. cleanup — `ownsBlobUrl` reconfere a posse antes de apagar, o que
 *     também protege linha já envenenada no banco ANTES desta correção.
 *
 * As duas barreiras usam o mesmo helper de posse (lib/blob-ownership.ts), que
 * saiu daqui pra ser reaproveitado por todo caminho que apaga blob a partir de
 * URL do banco — hoje também o DELETE de loja do super-admin.
 */

/** A key é uma que ESTE servidor assinou pra ESTA pasta? Senão, 400. */
function assertOwnKey(key: string, kind: UploadKind, tenantId: number): void {
  try {
    assertKeyInFolder(key, uploadFolder(kind, tenantId));
  } catch (err) {
    if (err instanceof UploadValidationError) {
      throw new ApiError(
        `Imagem de ${kind === "logo" ? "logo" : "hero"} inválida — envie o arquivo pelo próprio painel.`,
        err.status,
      );
    }
    throw err;
  }
}

/** Teto de tamanho da referência — espelha o `max(2048)` de `logo_url`. */
const REF_MAX_CHARS = 2048;

/**
 * Normaliza a referência de imagem de branding que o cliente mandou. Aceita:
 *
 *  a) `key` do presign (`tenants/{tenantId}/branding/{kind}/...`) — contrato
 *     preferido, igual ao de fotos/documentos/anexos: o servidor deriva a URL;
 *  b) a URL pública dessa mesma key — o que o `ImageUpload` já tem em mãos
 *     (/api/upload devolve `url`) e o que está gravado hoje em produção;
 *  c) URL externa http(s) fora do nosso storage — legado (o seed usa Unsplash
 *     no hero). Não é objeto nosso: guardar é inofensivo e `deleteFromBlob`
 *     nunca apaga nada com ela.
 *
 * Qualquer outra coisa — inclusive key/URL de OUTRO tenant, de outra pasta
 * (fotos de veículo!), `//host`, `javascript:` — é 400.
 */
function resolveBrandingRef(
  value: string | null | undefined,
  kind: UploadKind,
  tenantId: number,
): string | null {
  if (value == null) return null;
  const ref = value.trim();
  if (!ref) return null;
  if (ref.length > REF_MAX_CHARS) {
    throw new ApiError(`Referência de imagem muito longa (máx. ${REF_MAX_CHARS}).`, 400);
  }

  // (a)/(b) — objeto nosso: sempre passa pelo guard e é recanonizado a partir
  // da key, então o que vai pro banco nunca é string escolhida pelo cliente.
  const keyFromUrl = ownKeyFromUrl(ref);
  if (keyFromUrl !== null) {
    assertOwnKey(keyFromUrl, kind, tenantId);
    return publicUrlForKey(keyFromUrl);
  }

  if (/^https?:\/\//i.test(ref)) return ref; // (c)

  assertOwnKey(ref, kind, tenantId);
  return publicUrlForKey(ref);
}

export const PATCH = withTenant(async (req, { tenantId }) => {
  const tenant = await getTenantById(tenantId);
  if (!tenant) throw new ApiError("Concessionária não encontrada", 404);

  // Snapshot dos blobs atuais — pra detectar quais ficam órfãos depois do update.
  const oldLogoUrl = tenant.logo_url;
  const oldHeroUrl = resolveLayoutConfig(tenant.layout_config).heroImageUrl;

  // Lemos o body cru (não dá pra usar parseBody) pra acessar layout_config
  // + partner_banks, que ficam fora do storefrontSchema. JSON malformado
  // vira 400, não 500.
  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    throw new ApiError("Body inválido — JSON esperado.", 400);
  }
  const storefront = tenantStorefrontSchema.partial().parse(raw) as Partial<NewTenant>;
  const patch: Partial<NewTenant> = { ...storefront };

  // Logo — o zod só garante a forma; a posse é aqui.
  if ("logo_url" in patch) {
    patch.logo_url = resolveBrandingRef(patch.logo_url, "logo", tenantId);
  }

  // Layout — só planos com a capability (gating no servidor, nunca no cliente).
  // O hero passa pelo mesmo guard do logo (é o outro campo que vira delete).
  if (raw.layout_config !== undefined && capabilitiesFor(tenant.plan).layoutConfig) {
    patch.layout_config = sanitizeLayoutConfig(raw.layout_config, (value) =>
      resolveBrandingRef(value, "hero", tenantId),
    );
  }

  // Bancos parceiros — todos os planos. Filtra contra o catálogo mestre,
  // preserva ordem do envio, descarta slug desconhecido e duplicado.
  if (Array.isArray(raw.partner_banks)) {
    const seen = new Set<string>();
    const sanitized: string[] = [];
    for (const slug of raw.partner_banks) {
      if (typeof slug !== "string") continue;
      if (!BANKS_BY_SLUG[slug] || seen.has(slug)) continue;
      seen.add(slug);
      sanitized.push(slug);
    }
    patch.partner_banks = sanitized;
  }

  if (Object.keys(patch).length === 0) {
    throw new ApiError("Nada para atualizar.", 400);
  }

  const updated = await updateTenant(tenantId, patch);

  // Cleanup best-effort de blobs órfãos — se o save deu certo, qualquer
  // logo/hero substituído ou removido pode ser apagado da storage.
  // Falhas de cleanup não afetam o response.
  if (updated) {
    const newHeroUrl = resolveLayoutConfig(updated.layout_config).heroImageUrl;
    const orphans: { url: string; kind: UploadKind }[] = [];
    if (oldLogoUrl && oldLogoUrl !== updated.logo_url) {
      orphans.push({ url: oldLogoUrl, kind: "logo" });
    }
    if (oldHeroUrl && oldHeroUrl !== newHeroUrl) {
      orphans.push({ url: oldHeroUrl, kind: "hero" });
    }
    // Segunda barreira: só apagamos o que está PROVADAMENTE na pasta deste
    // tenant. Vale para o dado já gravado antes desta correção (URL alheia
    // plantada continua no banco, mas some do alcance do delete) e para
    // URL externa, que não é objeto nosso.
    const deletable = orphans.filter((o) => ownsBlobUrl(o.url, uploadFolder(o.kind, tenantId)));
    await Promise.allSettled(deletable.map((o) => deleteFromBlob(o.url)));
  }

  return NextResponse.json({ ok: true, tenant: updated });
});
