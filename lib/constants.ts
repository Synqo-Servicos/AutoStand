export const VEHICLE_STATUS = ["disponivel", "reservado", "vendido"] as const;
export type VehicleStatus = (typeof VEHICLE_STATUS)[number];

export const STATUS_LABELS: Record<VehicleStatus, string> = {
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido",
};

// Badge: fundo tonal + texto `ink` (legível) + anel/ponto colorido carregando
// o sinal semântico. `success`/`warning` são claros demais para servir de texto.
export const STATUS_BADGE_COLORS: Record<VehicleStatus, string> = {
  disponivel: "bg-success/15 text-ink ring-1 ring-success/40",
  reservado: "bg-warning/15 text-ink ring-1 ring-warning/40",
  vendido: "bg-n100 text-n600 ring-1 ring-n200",
};

export const STATUS_DOT_COLORS: Record<VehicleStatus, string> = {
  disponivel: "bg-success",
  reservado: "bg-warning",
  vendido: "bg-n400",
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

// Branding (nome, contatos, cores) vem do tenant — ver tabela `tenants` em lib/schema.ts.
