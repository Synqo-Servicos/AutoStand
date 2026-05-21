export type TransactionType =
  | "entrada"
  | "saida"
  | "despesa_direta"
  | "despesa_fixa"
  | "despesa_var"
  | "comissao";

export interface Transaction {
  id: number;
  /** Null em despesas operacionais (despesa_fixa, despesa_var). */
  vehicle_id: number | null;
  type: TransactionType;
  amount: number;
  date: string;
  category: string | null;
  seller_id: number | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  notes: string | null;
  created_at: string;
}

export type TransactionInput = Omit<Transaction, "id" | "created_at">;

export interface TransactionWithVehicle extends Transaction {
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
}

/** Tipos que requerem vehicle_id obrigatório. */
export const VEHICLE_TYPES = new Set<TransactionType>([
  "entrada",
  "saida",
  "despesa_direta",
]);

/** Tipos que são "despesa" (saem do caixa). */
export const EXPENSE_TYPES = new Set<TransactionType>([
  "despesa_direta",
  "despesa_fixa",
  "despesa_var",
  "comissao",
]);
