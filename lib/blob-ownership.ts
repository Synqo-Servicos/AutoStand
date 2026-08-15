import { publicUrlForKey } from "./blob";
import { assertKeyInFolder } from "./presign";

/**
 * Prova de posse de um objeto no storage — a pergunta "posso apagar esta URL?".
 *
 * Extraído de app/api/personalizar/route.ts (1b04c4b), onde nasceu para fechar
 * a falha cross-tenant do branding. A lógica saiu de lá porque ela não é do
 * branding: TODO caminho que chama `deleteFromBlob` a partir de uma URL vinda
 * do banco precisa da mesma resposta, e uma segunda cópia dela seria uma
 * segunda chance de errar. Hoje usam este módulo:
 *
 *  - PATCH /api/personalizar — cleanup de logo/hero órfãos;
 *  - DELETE /api/superadmin/tenants/[id] — varredura de blobs da loja excluída.
 *
 * A regra é sempre a mesma: só é nosso para apagar o objeto cuja URL pública
 * sai do nosso storage E cuja key está na pasta canônica esperada
 * (`uploadFolder`). Uma linha envenenada no banco — `logo_url` de uma loja
 * apontando para o arquivo de outra, o que o código vulnerável antigo permitia
 * gravar — falha a checagem e some do alcance do delete.
 */

/** Prefixo público de qualquer objeto nosso — CDN em prod, stub em dev. */
export function ownStoragePrefix(): string {
  return publicUrlForKey("");
}

/** Key do objeto a partir da URL pública; `null` quando a URL não é nossa. */
export function ownKeyFromUrl(url: string): string | null {
  const prefix = ownStoragePrefix();
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

/**
 * `true` só quando a URL aponta pra um objeto que ESTE servidor assinou pra
 * ESTA pasta — a única coisa que um cleanup pode apagar do bucket.
 *
 * `false` (nunca exceção) nos dois casos que não são erro: URL de outro tenant
 * / de outra pasta, que não é nossa para apagar, e URL externa (o seed usa
 * Unsplash no hero), que não é objeto nosso coisa nenhuma.
 */
export function ownsBlobUrl(url: string, folder: string): boolean {
  const key = ownKeyFromUrl(url);
  if (key === null) return false;
  try {
    assertKeyInFolder(key, folder);
    return true;
  } catch {
    return false;
  }
}
