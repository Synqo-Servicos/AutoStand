export const VEHICLE_STATUS = ["disponivel", "reservado", "vendido"] as const;
export type VehicleStatus = (typeof VEHICLE_STATUS)[number];

export const STATUS_LABELS: Record<VehicleStatus, string> = {
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido",
};

export const STATUS_BADGE_COLORS: Record<VehicleStatus, string> = {
  disponivel: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  reservado: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  vendido: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
};

export const STATUS_DOT_COLORS: Record<VehicleStatus, string> = {
  disponivel: "bg-emerald-500",
  reservado: "bg-amber-500",
  vendido: "bg-slate-400",
};

export const FUELS = ["flex", "gasolina", "etanol", "diesel", "eletrico", "hibrido"] as const;
export type Fuel = (typeof FUELS)[number];

export const FUEL_LABELS: Record<Fuel, string> = {
  flex: "Flex",
  gasolina: "Gasolina",
  etanol: "Etanol",
  diesel: "Diesel",
  eletrico: "Elétrico",
  hibrido: "Híbrido",
};

export const TRANSMISSIONS = ["automatico", "manual"] as const;
export type Transmission = (typeof TRANSMISSIONS)[number];

export const TRANSMISSION_LABELS: Record<Transmission, string> = {
  automatico: "Automático",
  manual: "Manual",
};

export const COMMON_BRANDS = [
  "Chevrolet",
  "Fiat",
  "Ford",
  "Honda",
  "Hyundai",
  "Jeep",
  "Mitsubishi",
  "Nissan",
  "Renault",
  "Toyota",
  "Volkswagen",
  "BMW",
  "Mercedes-Benz",
  "Audi",
  "Kia",
  "Peugeot",
  "Citroën",
] as const;

export const TRANSACTION_TYPES = ["entrada", "saida"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_LABELS: Record<TransactionType, string> = {
  entrada: "Entrada",
  saida: "Saída",
};

export const WHATSAPP_NUMBER = "5582998287879";
export const DEALERSHIP_NAME = "Pedro Ivo Veículos";
export const DEALERSHIP_INSTAGRAM = "https://www.instagram.com/pedroivo_veiculos/";
export const BUSINESS_HOURS = "Seg–Sex: 8h às 18h";
