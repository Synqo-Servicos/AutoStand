/**
 * Normalização de telefone para links do WhatsApp (wa.me).
 *
 * Fonte única — antes essa lógica estava duplicada e divergente
 * (LeadCard adicionava DDI 55, a rota social removia, e vários storefronts
 * usavam `whatsapp_number` cru, quebrando quando o valor tinha formatação).
 */

/**
 * Telefone (digitado ou armazenado) → só dígitos, com DDI 55 (Brasil) quando
 * ausente. Números que já têm o DDI (>= 12 dígitos) ficam intactos, então é
 * seguro tanto para telefone de lead (digitado sem 55) quanto para o
 * `whatsapp_number` do tenant (armazenado com 55).
 */
export function waNumber(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length <= 11 && !d.startsWith("55")) d = `55${d}`;
  return d;
}

/**
 * Monta a URL do wa.me a partir de um telefone, com texto opcional
 * pré-preenchido. Retorna `null` quando não há número.
 */
export function waHref(
  raw: string | null | undefined,
  text?: string,
): string | null {
  if (!raw) return null;
  const n = waNumber(raw);
  if (!n) return null;
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${n}${query}`;
}
