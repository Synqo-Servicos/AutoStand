/**
 * Catálogo mestre dos bancos que aparecem como "parceiros" no site público
 * de cada concessionária.
 *
 * O tenant guarda em `partner_banks` apenas o array de `slug`. O resto é
 * resolvido aqui em runtime. Para adicionar um banco novo:
 *  1) cria uma entrada abaixo
 *  2) coloca o SVG em `public/banks/<slug>.svg` (ver `scripts/...` se útil)
 *
 * Logos atuais são "wordmarks" simples (texto sobre a cor da marca), pra
 * evitar disputas de uso de marca em ambiente de demo. Substituir por
 * SVGs oficiais conforme contratos comerciais forem fechados.
 */

export interface Bank {
  slug: string;
  /** Nome exibido (já abreviado quando faz sentido). */
  name: string;
  /** Caminho público da logo SVG. */
  logo: string;
}

export const BANKS: Bank[] = [
  { slug: "bb",         name: "Banco do Brasil", logo: "/banks/bb.svg" },
  { slug: "itau",       name: "Itaú",            logo: "/banks/itau.svg" },
  { slug: "bradesco",   name: "Bradesco",        logo: "/banks/bradesco.svg" },
  { slug: "santander",  name: "Santander",       logo: "/banks/santander.svg" },
  { slug: "caixa",      name: "Caixa",           logo: "/banks/caixa.svg" },
  { slug: "bv",         name: "BV",              logo: "/banks/bv.svg" },
  { slug: "pan",        name: "Pan",             logo: "/banks/pan.svg" },
  { slug: "safra",      name: "Safra",           logo: "/banks/safra.svg" },
  { slug: "daycoval",   name: "Daycoval",        logo: "/banks/daycoval.svg" },
  { slug: "omni",       name: "Omni",            logo: "/banks/omni.svg" },
  { slug: "sicredi",    name: "Sicredi",         logo: "/banks/sicredi.svg" },
  { slug: "sicoob",     name: "Sicoob",          logo: "/banks/sicoob.svg" },
  { slug: "c6",         name: "C6 Bank",         logo: "/banks/c6.svg" },
  { slug: "original",   name: "Original",        logo: "/banks/original.svg" },
];

export const BANKS_BY_SLUG: Record<string, Bank> = Object.fromEntries(
  BANKS.map((b) => [b.slug, b]),
);

/** Resolve uma lista de slugs (vinda do tenant) para os bancos correspondentes,
 *  ignorando slugs desconhecidos e preservando a ordem do catálogo. */
export function resolveBanks(slugs: string[] | null | undefined): Bank[] {
  if (!slugs || slugs.length === 0) return [];
  const set = new Set(slugs);
  return BANKS.filter((b) => set.has(b.slug));
}
