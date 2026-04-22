export interface Vehicle {
  id: number;
  brand: string;
  model: string;
  year: number;
  km: number;
  cost_price: number;
  sale_price: number;
  transmission: string;
  fuel: string;
  color: string;
  doors: number;
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
