export interface Vehicle {
  id: number;
  brand: string;
  model: string;
  /** Versão/trim — ex.: "1.0 Turbo Premium". */
  version: string | null;
  /** Ano modelo. */
  year: number;
  /** Ano de fabricação. */
  year_manufacture: number | null;
  km: number;
  cost_price: number;
  sale_price: number;
  transmission: string;
  fuel: string;
  color: string;
  doors: number;
  /** Carroceria — 'hatch' | 'sedan' | 'suv' | ... */
  body_type: string | null;
  /** 'novo' | 'seminovo' | 'usado' */
  condition: string;
  /** Opcionais — lista de strings. */
  optionals: string[] | null;
  armored: boolean;
  single_owner: boolean;
  fipe_code: string | null;
  /** Placa Mercosul ou antiga (sem traço). */
  plate: string | null;
  description: string | null;
  status: string;
  primary_photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehiclePhoto {
  id: number;
  vehicle_id: number;
  url: string;
  order_idx: number;
  created_at: string;
}

export interface VehicleWithPhotos extends Vehicle {
  photos: VehiclePhoto[];
}

export type VehicleInput = Omit<Vehicle, "id" | "created_at" | "updated_at">;
