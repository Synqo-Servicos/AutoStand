/**
 * Renderiza um template de documento (TemplateId) em PDF (Buffer).
 *
 * Cada template tem um componente em `components/pdf/templates/<id>.tsx`.
 */
import { type DocumentProps, renderToBuffer } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { TenantRow } from "@/lib/schema";
import type { Vehicle } from "@/types/vehicle";
import { getTemplate, type TemplateId } from "@/lib/document-templates";
import type { BaseDocumentData } from "@/components/pdf/shared/BaseDocument";

import { CompraVendaPDF } from "@/components/pdf/templates/compra_venda";
import { ReciboSinalPDF } from "@/components/pdf/templates/recibo_sinal";
import { ConsignacaoPDF } from "@/components/pdf/templates/consignacao";
import { GarantiaPDF } from "@/components/pdf/templates/garantia";
import { OsPreparacaoPDF } from "@/components/pdf/templates/os_preparacao";
import { TestDrivePDF } from "@/components/pdf/templates/test_drive";
import { ProcuracaoPDF } from "@/components/pdf/templates/procuracao_transferencia";
import { ChecklistEntradaPDF } from "@/components/pdf/templates/checklist_entrada";

type Component = (props: { data: BaseDocumentData }) => React.ReactElement;

const COMPONENTS: Record<TemplateId, Component> = {
  compra_venda: CompraVendaPDF,
  recibo_sinal: ReciboSinalPDF,
  consignacao: ConsignacaoPDF,
  garantia: GarantiaPDF,
  os_preparacao: OsPreparacaoPDF,
  test_drive: TestDrivePDF,
  procuracao_transferencia: ProcuracaoPDF,
  checklist_entrada: ChecklistEntradaPDF,
};

export async function renderTemplate(
  templateId: TemplateId,
  payload: {
    tenant: TenantRow;
    vehicle: Vehicle | null;
    formData: Record<string, string | number | boolean | null | undefined>;
  },
): Promise<Buffer> {
  const template = getTemplate(templateId);
  if (!template) throw new Error(`Template desconhecido: ${templateId}`);
  if (template.requiresVehicle && !payload.vehicle) {
    throw new Error(`Template "${template.name}" requer um veículo do estoque.`);
  }
  const Component = COMPONENTS[templateId];
  const element = createElement(Component, {
    data: {
      tenant: payload.tenant,
      vehicle: payload.vehicle,
      formData: payload.formData,
    },
  }) as unknown as ReactElement<DocumentProps>;
  return renderToBuffer(element);
}

// ---------------------------------------------------------------------------
// Helpers usados pelos templates

export function brl(cents: number | string | null | undefined): string {
  const n = typeof cents === "string" ? parseFloat(cents.replace(/[^\d,.-]/g, "").replace(",", ".")) : cents;
  if (n === null || n === undefined || Number.isNaN(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Para valores que vêm como reais (não centavos) do form. */
export function brlFromReais(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "R$ 0,00";
  const n = typeof value === "string" ? parseFloat(value.toString().replace(/\./g, "").replace(",", ".")) : value;
  if (Number.isNaN(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(value: string | null | undefined, fallback = "____/____/______"): string {
  if (!value) return fallback;
  // Aceita ISO (YYYY-MM-DD) ou data já formatada.
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.split("T")[0].split("-");
    return `${d}/${m}/${y}`;
  }
  return value;
}

export function pickStr(formData: Record<string, unknown>, key: string, fallback = ""): string {
  const v = formData[key];
  if (v === null || v === undefined) return fallback;
  return String(v);
}

export function pickNum(formData: Record<string, unknown>, key: string, fallback = 0): number {
  const v = formData[key];
  if (v === null || v === undefined || v === "") return fallback;
  const n = typeof v === "string" ? parseFloat(v.replace(/\./g, "").replace(",", ".")) : Number(v);
  return Number.isNaN(n) ? fallback : n;
}
