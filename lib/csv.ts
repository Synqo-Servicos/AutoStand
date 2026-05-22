/**
 * Geração de CSV simples para exportações financeiras.
 * Usa `;` como separador (padrão do Excel pt-BR) e adiciona BOM UTF-8
 * para preservar acentos quando aberto no Excel.
 */

export const CSV_BOM = "﻿";

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[;"\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsvRow(cells: unknown[]): string {
  return cells.map(escapeCell).join(";");
}

export function joinCsv(rows: (string | string[])[]): string {
  return rows.map((r) => (Array.isArray(r) ? toCsvRow(r) : r)).join("\r\n");
}

/** Formata centavos no estilo pt-BR sem prefixo R$ (próprio para CSV). */
export function centsToCsv(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
