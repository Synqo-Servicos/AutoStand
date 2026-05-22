export interface Seller {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  photo_url: string | null;
  /**
   * Comissão percentual em "basis points" (1/100 de %).
   * Ex.: 350 = 3.5% sobre o valor da venda. Null = sem componente percentual.
   */
  commission_pct: number | null;
  /** Comissão fixa em centavos. Null = sem componente fixo. */
  commission_fixed_cents: number | null;
  status: "ativo" | "desligado";
  created_at: string;
}

export type SellerInput = Omit<Seller, "id" | "created_at">;
