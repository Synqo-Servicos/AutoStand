export interface Transaction {
  id: number;
  vehicle_id: number;
  type: "entrada" | "saida";
  amount: number;
  date: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  notes: string | null;
  created_at: string;
}

export type TransactionInput = Omit<Transaction, "id" | "created_at">;

export interface TransactionWithVehicle extends Transaction {
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_year: number;
}
