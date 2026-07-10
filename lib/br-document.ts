/**
 * Validação e máscara de CPF/CNPJ. Módulo puro (sem deps de server) — pode ser
 * importado no client (form) e no server (rota). Não havia validador na base.
 */

/** Só dígitos. */
export function normalizeDocument(raw: string): string {
  return (raw ?? "").replace(/\D/g, "");
}

export function detectDocumentType(digits: string): "cpf" | "cnpj" | null {
  if (digits.length === 11) return "cpf";
  if (digits.length === 14) return "cnpj";
  return null;
}

function isValidCpf(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10]);
}

function isValidCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const dv = (len: number) => {
    const weights =
      len === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cnpj[i]) * weights[i];
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  return dv(12) === Number(cnpj[12]) && dv(13) === Number(cnpj[13]);
}

/** Valida CPF ou CNPJ (aceita com ou sem máscara). */
export function isValidDocument(raw: string): boolean {
  const digits = normalizeDocument(raw);
  const type = detectDocumentType(digits);
  if (type === "cpf") return isValidCpf(digits);
  if (type === "cnpj") return isValidCnpj(digits);
  return false;
}

/** Máscara dinâmica para input controlado. */
export function formatDocument(raw: string): string {
  const d = normalizeDocument(raw).slice(0, 14);
  if (d.length <= 11) {
    const p = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 11)];
    let out = p[0];
    if (p[1]) out += "." + p[1];
    if (p[2]) out += "." + p[2];
    if (p[3]) out += "-" + p[3];
    return out;
  }
  const p = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8), d.slice(8, 12), d.slice(12, 14)];
  let out = p[0];
  if (p[1]) out += "." + p[1];
  if (p[2]) out += "." + p[2];
  if (p[3]) out += "/" + p[3];
  if (p[4]) out += "-" + p[4];
  return out;
}
